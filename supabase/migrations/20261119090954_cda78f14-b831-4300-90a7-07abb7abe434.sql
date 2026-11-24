CREATE OR REPLACE FUNCTION public.wall_upgrade_hero(_tg bigint, _hero integer)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _lvl int; _prev int; _cost numeric; _bal numeric;
BEGIN
  IF _hero < 0 OR _hero > 4 THEN RAISE EXCEPTION 'bad_hero'; END IF;
  PERFORM wall_mining_claim(_tg);
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
  -- Balance is a requirement only; upgrading keeps the player's coins.
  UPDATE wall_hero_levels SET level = _lvl + 1, updated_at = now() WHERE tg_id = _tg AND hero = _hero;
  UPDATE wall_users SET total_level = (SELECT sum(level) FROM wall_hero_levels WHERE tg_id = _tg) WHERE tg_id = _tg;
  RETURN _lvl + 1;
END $function$;

-- One-time refund of every coin spent on hero levels so far; levels are kept.
UPDATE wall_users u SET balance = u.balance + r.spent
FROM (
  SELECT h.tg_id, sum(public.wall_hero_cost(h.hero, g.l)) AS spent
  FROM wall_hero_levels h CROSS JOIN LATERAL generate_series(0, h.level - 1) AS g(l)
  WHERE h.level > 0 GROUP BY h.tg_id
) r WHERE u.tg_id = r.tg_id;