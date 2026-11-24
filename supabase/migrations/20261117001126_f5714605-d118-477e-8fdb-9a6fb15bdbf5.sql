ALTER TABLE public.wall_users ADD COLUMN IF NOT EXISTS total_level integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS mined_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS wall_users_total_level_idx ON public.wall_users (total_level DESC);

CREATE TABLE public.wall_hero_levels (
  tg_id bigint NOT NULL REFERENCES public.wall_users(tg_id) ON DELETE CASCADE,
  hero smallint NOT NULL,
  level integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tg_id, hero)
);
GRANT ALL ON public.wall_hero_levels TO service_role;
ALTER TABLE public.wall_hero_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service only" ON public.wall_hero_levels FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Mirrors src/lib/heroes-model.ts
CREATE OR REPLACE FUNCTION public.wall_hero_rate(_hero int, _level int) RETURNS numeric
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT (power(2, _hero) * 2 * _level)::numeric $$;
CREATE OR REPLACE FUNCTION public.wall_hero_cost(_hero int, _level int) RETURNS numeric
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT round(50 * power(1.035, _level) * power(3, _hero))::numeric $$;

CREATE OR REPLACE FUNCTION public.wall_mining_rate(_tg bigint) RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(sum(wall_hero_rate(hero, level)),0) FROM wall_hero_levels WHERE tg_id = _tg $$;

CREATE OR REPLACE FUNCTION public.wall_ensure_heroes(_tg bigint) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO wall_hero_levels(tg_id, hero, level) VALUES (_tg, 0, 1) ON CONFLICT DO NOTHING $$;

CREATE OR REPLACE FUNCTION public.wall_mining_claim(_tg bigint) RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _at timestamptz; _hrs numeric; _amt numeric;
BEGIN
  PERFORM wall_ensure_heroes(_tg);
  SELECT mined_at INTO _at FROM wall_users WHERE tg_id = _tg FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_user'; END IF;
  _hrs := LEAST(3, EXTRACT(EPOCH FROM now() - _at) / 3600.0);
  _amt := round(wall_mining_rate(_tg) * _hrs, 2);
  UPDATE wall_users SET balance = balance + _amt, mined_at = now() WHERE tg_id = _tg;
  RETURN _amt;
END $$;

CREATE OR REPLACE FUNCTION public.wall_upgrade_hero(_tg bigint, _hero int) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _lvl int; _prev int; _cost numeric; _bal numeric;
BEGIN
  IF _hero < 0 OR _hero > 4 THEN RAISE EXCEPTION 'bad_hero'; END IF;
  PERFORM wall_mining_claim(_tg); -- settle at old rate first
  IF _hero > 0 THEN
    SELECT level INTO _prev FROM wall_hero_levels WHERE tg_id = _tg AND hero = _hero - 1;
    IF COALESCE(_prev,0) < 200 THEN RAISE EXCEPTION 'locked'; END IF;
  END IF;
  INSERT INTO wall_hero_levels(tg_id, hero, level) VALUES (_tg, _hero, 0) ON CONFLICT DO NOTHING;
  SELECT level INTO _lvl FROM wall_hero_levels WHERE tg_id = _tg AND hero = _hero FOR UPDATE;
  IF _lvl >= 200 THEN RAISE EXCEPTION 'max_level'; END IF;
  _cost := wall_hero_cost(_hero, _lvl);
  SELECT balance INTO _bal FROM wall_users WHERE tg_id = _tg FOR UPDATE;
  IF _bal < _cost THEN RAISE EXCEPTION 'not_enough'; END IF;
  UPDATE wall_users SET balance = balance - _cost,
    total_level = (SELECT sum(level) FROM wall_hero_levels WHERE tg_id = _tg) + 1 WHERE tg_id = _tg;
  UPDATE wall_hero_levels SET level = _lvl + 1, updated_at = now() WHERE tg_id = _tg AND hero = _hero;
  RETURN _lvl + 1;
END $$;

REVOKE ALL ON FUNCTION public.wall_mining_rate(bigint), public.wall_ensure_heroes(bigint),
  public.wall_mining_claim(bigint), public.wall_upgrade_hero(bigint,int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wall_mining_rate(bigint), public.wall_ensure_heroes(bigint),
  public.wall_mining_claim(bigint), public.wall_upgrade_hero(bigint,int) TO service_role;