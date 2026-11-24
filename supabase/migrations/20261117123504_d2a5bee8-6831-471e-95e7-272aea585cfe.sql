CREATE OR REPLACE FUNCTION public.wall_raid_spin(_tg bigint, _revenge bigint DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    _seg := CASE WHEN _r < 35 THEN 'coins' WHEN _r < 45 THEN 'jackpot_coins' WHEN _r < 60 THEN 'shield' WHEN _r < 82 THEN 'raid' ELSE 'key' END;
  END IF;

  IF _seg = 'coins' THEN _amt := 10;
  ELSIF _seg = 'jackpot_coins' THEN _amt := 50;
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
END $$;
CREATE OR REPLACE FUNCTION public.wall_novel_play(_tg bigint, _risk text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r wall_novel_progress; _chance int; _mult numeric; _base bigint; _win boolean; _coins bigint := 0; _pen bigint := 0; _bal bigint; _cleared boolean := false;
BEGIN
  PERFORM 1 FROM wall_users WHERE tg_id = _tg FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_user'; END IF;
  _r := wall_novel_row(_tg);
  CASE _risk
    WHEN 'safe' THEN _chance := 80; _mult := 0.5;
    WHEN 'bold' THEN _chance := 55; _mult := 1;
    WHEN 'reckless' THEN _chance := 30; _mult := 2.5;
    WHEN 'blade' THEN _chance := 100; _mult := 3;
    ELSE RAISE EXCEPTION 'bad_risk';
  END CASE;
  IF _risk <> 'blade' THEN _chance := _chance - least(15, _r.chapter - 1); END IF;
  IF _r.plays_used < 5 + _r.ads_used THEN
    UPDATE wall_novel_progress SET plays_used = plays_used + 1 WHERE tg_id = _tg;
  ELSIF _r.bonus_plays > 0 THEN
    UPDATE wall_novel_progress SET bonus_plays = bonus_plays - 1 WHERE tg_id = _tg;
  ELSE RAISE EXCEPTION 'no_plays'; END IF;
  IF _risk = 'blade' THEN
    UPDATE wall_story_state SET blades = blades - 1 WHERE tg_id = _tg AND blades > 0;
    IF NOT FOUND THEN RAISE EXCEPTION 'no_item'; END IF;
  END IF;
  _base := 2 + (_r.chapter - 1) / 4;
  IF _r.step = 3 THEN _base := _base * 2; END IF;
  _win := (random() * 100) < _chance;
  IF _win THEN
    _coins := floor(_base * _mult);
    UPDATE wall_users SET balance = balance + _coins WHERE tg_id = _tg;
    IF _r.step >= 3 THEN
      _cleared := true;
      UPDATE wall_novel_progress SET chapter = chapter + 1, step = 1, hearts = 3, wins = wins + 1, updated_at = now() WHERE tg_id = _tg;
    ELSE
      UPDATE wall_novel_progress SET step = step + 1, wins = wins + 1, updated_at = now() WHERE tg_id = _tg;
    END IF;
  ELSE
    IF _r.hearts <= 1 THEN
      SELECT balance INTO _bal FROM wall_users WHERE tg_id = _tg;
      _pen := least(greatest(_bal, 0), _r.chapter);
      UPDATE wall_users SET balance = balance - _pen WHERE tg_id = _tg;
      UPDATE wall_novel_progress SET hearts = 3, step = 1, losses = losses + 1, updated_at = now() WHERE tg_id = _tg;
    ELSE
      UPDATE wall_novel_progress SET hearts = hearts - 1, losses = losses + 1, updated_at = now() WHERE tg_id = _tg;
    END IF;
  END IF;
  RETURN jsonb_build_object('win', _win, 'coins', _coins, 'penalty', _pen, 'cleared', _cleared);
END $$;
UPDATE public.wall_vault SET pot = round(pot / 100) WHERE id = 1;