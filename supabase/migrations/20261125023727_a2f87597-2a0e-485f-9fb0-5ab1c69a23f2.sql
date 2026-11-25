CREATE POLICY server_only ON public.wall_energy FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY server_only ON public.wall_game_ad_claims FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY server_only ON public.wall_squad_members FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE INDEX IF NOT EXISTS wall_game_ad_claims_tg_id_idx ON public.wall_game_ad_claims(tg_id);
CREATE INDEX IF NOT EXISTS wall_squads_captain_idx ON public.wall_squads(captain);

ALTER TABLE public.wall_squad_scores ADD COLUMN IF NOT EXISTS rank integer;
ALTER TABLE public.wall_squad_scores ADD COLUMN IF NOT EXISTS prize_gram numeric NOT NULL DEFAULT 0;

CREATE TABLE public.wall_squad_weeks (
  week timestamptz PRIMARY KEY,
  prize_pool numeric NOT NULL DEFAULT 10,
  settled_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wall_squad_weeks TO anon, authenticated;
GRANT ALL ON public.wall_squad_weeks TO service_role;
ALTER TABLE public.wall_squad_weeks ENABLE ROW LEVEL SECURITY;
CREATE POLICY squad_weeks_public_read ON public.wall_squad_weeks FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.wall_settle_squad_weeks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cur timestamptz := date_trunc('week', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  _w record;
  _row record;
  _rank integer;
  _prize numeric;
  _mcount integer;
  _share numeric;
  _settled integer := 0;
BEGIN
  FOR _w IN
    SELECT DISTINCT s.week
    FROM public.wall_squad_scores s
    WHERE s.week < _cur
      AND NOT EXISTS (SELECT 1 FROM public.wall_squad_weeks w WHERE w.week = s.week)
    ORDER BY s.week
  LOOP
    INSERT INTO public.wall_squad_weeks(week, prize_pool) VALUES (_w.week, 10) ON CONFLICT DO NOTHING;
    IF NOT FOUND THEN CONTINUE; END IF;
    _rank := 0;
    FOR _row IN
      SELECT squad_id, points
      FROM public.wall_squad_scores
      WHERE week = _w.week AND points > 0
      ORDER BY points DESC, updated_at ASC
    LOOP
      _rank := _rank + 1;
      _prize := CASE _rank WHEN 1 THEN 5 WHEN 2 THEN 3 WHEN 3 THEN 2 ELSE 0 END;
      UPDATE public.wall_squad_scores
      SET rank = _rank, prize_gram = _prize
      WHERE week = _w.week AND squad_id = _row.squad_id;
      IF _prize > 0 THEN
        SELECT count(*) INTO _mcount FROM public.wall_squad_members WHERE squad_id = _row.squad_id;
        IF _mcount > 0 THEN
          _share := round(_prize / _mcount, 4);
          UPDATE public.wall_users u
          SET gram_balance = u.gram_balance + _share
          FROM public.wall_squad_members m
          WHERE m.squad_id = _row.squad_id AND m.tg_id = u.tg_id;
        END IF;
      END IF;
    END LOOP;
    _settled := _settled + 1;
  END LOOP;
  RETURN _settled;
END;
$$;

REVOKE ALL ON FUNCTION public.wall_settle_squad_weeks() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wall_settle_squad_weeks() TO service_role;

CREATE OR REPLACE FUNCTION public.wall_raid_spin(_tg bigint, _revenge bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _s wall_raid_state; _r double precision; _seg text; _amt numeric := 0;
  _victim bigint; _vbal numeric; _vsh integer; _blocked boolean := false; _pot numeric; _won numeric := 0; _raid wall_raids;
BEGIN
  _s := wall_raid_load(_tg);
  IF _revenge IS NOT NULL THEN
    SELECT * INTO _raid FROM wall_raids WHERE id = _revenge AND victim = _tg AND NOT avenged AND NOT blocked FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'no_revenge'; END IF;
  END IF;
  IF _s.spins <= 0 THEN RAISE EXCEPTION 'no_spins'; END IF;
  UPDATE wall_raid_state SET spins = spins - 1, spins_at = CASE WHEN spins >= 5 THEN now() ELSE spins_at END WHERE tg_id = _tg;
  UPDATE wall_vault SET pot = pot + 3 WHERE id = 1;

  IF _revenge IS NOT NULL THEN _seg := 'raid'; _victim := _raid.attacker;
  ELSE
    _r := random() * 100;
    _seg := CASE
      WHEN _r < 34 THEN 'coins'
      WHEN _r < 44 THEN 'jackpot_coins'
      WHEN _r < 59 THEN 'shield'
      WHEN _r < 80 THEN 'raid'
      WHEN _r < 98 THEN 'key'
      ELSE 'gram'
    END;
  END IF;

  IF _seg = 'coins' THEN _amt := 10;
  ELSIF _seg = 'jackpot_coins' THEN _amt := 50;
  ELSIF _seg = 'gram' THEN
    _amt := 3;
    UPDATE wall_users SET gram_balance = gram_balance + _amt WHERE tg_id = _tg;
    RETURN jsonb_build_object('segment', _seg, 'amount', _amt, 'blocked', false, 'victim', NULL);
  ELSIF _seg = 'shield' THEN
    IF _s.shields >= 3 THEN _amt := 15; ELSE UPDATE wall_raid_state SET shields = shields + 1 WHERE tg_id = _tg; END IF;
  ELSIF _seg = 'key' THEN
    IF _s.keys + 1 >= 3 THEN
      SELECT pot INTO _pot FROM wall_vault WHERE id = 1 FOR UPDATE;
      _won := round(_pot * 0.1);
      UPDATE wall_vault SET pot = pot - _won, last_winner = _tg, last_win = _won, last_win_at = now() WHERE id = 1;
      UPDATE wall_raid_state SET keys = 0 WHERE tg_id = _tg;
      _amt := _won; _seg := 'vault';
    ELSE UPDATE wall_raid_state SET keys = keys + 1 WHERE tg_id = _tg; END IF;
  ELSIF _seg = 'raid' THEN
    IF _victim IS NULL THEN
      SELECT tg_id INTO _victim FROM wall_users WHERE tg_id <> _tg AND balance > 0 ORDER BY random() LIMIT 1;
    END IF;
    IF _victim IS NULL THEN _seg := 'coins'; _amt := 10;
    ELSE
      INSERT INTO wall_raid_state(tg_id) VALUES (_victim) ON CONFLICT DO NOTHING;
      SELECT shields INTO _vsh FROM wall_raid_state WHERE tg_id = _victim FOR UPDATE;
      SELECT balance INTO _vbal FROM wall_users WHERE tg_id = _victim FOR UPDATE;
      IF _vsh > 0 THEN
        _blocked := true; _amt := 3;
        UPDATE wall_raid_state SET shields = shields - 1 WHERE tg_id = _victim;
      ELSE
        _amt := LEAST(round(_vbal * 0.1), 500);
        UPDATE wall_users SET balance = balance - _amt WHERE tg_id = _victim;
      END IF;
      INSERT INTO wall_raids(attacker, victim, amount, blocked, revenge) VALUES (_tg, _victim, CASE WHEN _blocked THEN 0 ELSE _amt END, _blocked, _revenge IS NOT NULL);
      IF _revenge IS NOT NULL THEN UPDATE wall_raids SET avenged = true WHERE id = _revenge; END IF;
    END IF;
  END IF;

  IF _amt > 0 THEN UPDATE wall_users SET balance = balance + _amt WHERE tg_id = _tg; END IF;
  RETURN jsonb_build_object('segment', _seg, 'amount', _amt, 'blocked', _blocked, 'victim', _victim);
END $function$;