CREATE TABLE public.wall_novel_progress (
  tg_id bigint PRIMARY KEY,
  chapter integer NOT NULL DEFAULT 1,
  step integer NOT NULL DEFAULT 1,
  hearts integer NOT NULL DEFAULT 3,
  day date NOT NULL DEFAULT current_date,
  plays_used integer NOT NULL DEFAULT 0,
  ads_used integer NOT NULL DEFAULT 0,
  bonus_plays integer NOT NULL DEFAULT 0,
  wins integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.wall_novel_progress TO service_role;
ALTER TABLE public.wall_novel_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wall_novel_progress server only" ON public.wall_novel_progress FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- Loads (and daily-resets) the caller's row.
CREATE OR REPLACE FUNCTION public.wall_novel_row(_tg bigint) RETURNS wall_novel_progress
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r wall_novel_progress;
BEGIN
  INSERT INTO wall_novel_progress(tg_id) VALUES (_tg) ON CONFLICT DO NOTHING;
  UPDATE wall_novel_progress SET day = current_date, plays_used = 0, ads_used = 0 WHERE tg_id = _tg AND day <> current_date;
  SELECT * INTO _r FROM wall_novel_progress WHERE tg_id = _tg FOR UPDATE;
  RETURN _r;
END $$;

-- One encounter. Outcome, reward and penalty are decided here only.
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
  _base := 100 + 25 * (_r.chapter - 1);
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
      _pen := least(greatest(_bal, 0), 50 * _r.chapter);
      UPDATE wall_users SET balance = balance - _pen WHERE tg_id = _tg;
      UPDATE wall_novel_progress SET hearts = 3, step = 1, losses = losses + 1, updated_at = now() WHERE tg_id = _tg;
    ELSE
      UPDATE wall_novel_progress SET hearts = hearts - 1, losses = losses + 1, updated_at = now() WHERE tg_id = _tg;
    END IF;
  END IF;
  RETURN jsonb_build_object('win', _win, 'coins', _coins, 'penalty', _pen, 'cleared', _cleared);
END $$;

-- Rewarded ad: +1 play, at most 3 per day.
CREATE OR REPLACE FUNCTION public.wall_novel_ad(_tg bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r wall_novel_progress;
BEGIN
  _r := wall_novel_row(_tg);
  IF _r.ads_used >= 3 THEN RAISE EXCEPTION 'ad_limit'; END IF;
  UPDATE wall_novel_progress SET ads_used = ads_used + 1 WHERE tg_id = _tg;
  RETURN jsonb_build_object('ads', _r.ads_used + 1);
END $$;

REVOKE ALL ON FUNCTION public.wall_novel_row(bigint), public.wall_novel_play(bigint, text), public.wall_novel_ad(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wall_novel_row(bigint), public.wall_novel_play(bigint, text), public.wall_novel_ad(bigint) TO service_role;

CREATE OR REPLACE FUNCTION public.wall_confirm_payment(_id uuid, _tx text) RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p wall_payments; _d smallint; _sp integer; _need bigint;
BEGIN
 SELECT * INTO _p FROM wall_payments WHERE id = _id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'no_payment'; END IF;
 IF _p.status IN ('paid','refund_due') THEN RETURN 0; END IF;
 PERFORM 1 FROM wall_users WHERE tg_id = _p.tg_id FOR UPDATE;
 IF _p.pack = 'mine_pass' THEN
  IF _p.amount_nano <> 50000000 OR _p.coins <> 0 THEN RAISE EXCEPTION 'bad_pass_payment'; END IF;
  INSERT INTO wall_mine_passes(tg_id, payment_id) VALUES (_p.tg_id, _p.id) ON CONFLICT (tg_id) DO NOTHING;
  IF FOUND THEN UPDATE wall_users SET mined_at = now() WHERE tg_id = _p.tg_id; END IF;
 ELSIF _p.pack = 'nft_mint' THEN
  IF _p.amount_nano <> 5000000000 OR _p.coins <> 0 THEN RAISE EXCEPTION 'bad_nft_payment'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('wall_nft_mint'));
  _d := wall_nft_pick(random());
  IF _d IS NULL THEN
   UPDATE wall_payments SET status = 'refund_due', tx_hash = _tx, paid_at = now() WHERE id = _id;
   RETURN 0;
  END IF;
  INSERT INTO wall_nfts(tg_id, design, payment_id) VALUES (_p.tg_id, _d, _p.id) ON CONFLICT (payment_id) DO NOTHING;
 ELSIF _p.pack IN ('spins_20','spins_60','spins_250') THEN
  _sp := CASE _p.pack WHEN 'spins_20' THEN 20 WHEN 'spins_60' THEN 60 WHEN 'spins_250' THEN 250 END;
  _need := CASE _p.pack WHEN 'spins_20' THEN 500000000 WHEN 'spins_60' THEN 1000000000 ELSE 3000000000 END;
  IF _p.coins <> 0 OR _p.amount_nano <> _need THEN RAISE EXCEPTION 'bad_spin_payment'; END IF;
  INSERT INTO wall_raid_state(tg_id) VALUES (_p.tg_id) ON CONFLICT DO NOTHING;
  UPDATE wall_raid_state SET spins = spins + _sp WHERE tg_id = _p.tg_id;
 ELSIF _p.pack = 'novel_plays_5' THEN
  IF _p.coins <> 0 OR _p.amount_nano <> 300000000 THEN RAISE EXCEPTION 'bad_novel_payment'; END IF;
  PERFORM wall_novel_row(_p.tg_id);
  UPDATE wall_novel_progress SET bonus_plays = bonus_plays + 5 WHERE tg_id = _p.tg_id;
 ELSIF _p.pack IN ('story_tries_3','story_hint','story_letter','story_blade') THEN
  _need := CASE _p.pack WHEN 'story_tries_3' THEN 500000000 WHEN 'story_hint' THEN 200000000 WHEN 'story_blade' THEN 400000000 ELSE 300000000 END;
  IF _p.coins <> 0 OR _p.amount_nano <> _need THEN RAISE EXCEPTION 'bad_story_payment'; END IF;
  INSERT INTO wall_story_state(tg_id) VALUES (_p.tg_id) ON CONFLICT DO NOTHING;
  IF _p.pack = 'story_tries_3' THEN UPDATE wall_story_state SET extra_tries = extra_tries + 3 WHERE tg_id = _p.tg_id;
  ELSIF _p.pack = 'story_hint' THEN UPDATE wall_story_state SET hints = hints + 1 WHERE tg_id = _p.tg_id;
  ELSIF _p.pack = 'story_blade' THEN UPDATE wall_story_state SET blades = blades + 1 WHERE tg_id = _p.tg_id;
  ELSE UPDATE wall_story_state SET letters = letters + 1 WHERE tg_id = _p.tg_id; END IF;
 ELSE
  UPDATE wall_users SET balance = balance + _p.coins WHERE tg_id = _p.tg_id;
 END IF;
 UPDATE wall_payments SET status = 'paid', tx_hash = _tx, paid_at = now() WHERE id = _id;
 RETURN _p.coins;
END $$;