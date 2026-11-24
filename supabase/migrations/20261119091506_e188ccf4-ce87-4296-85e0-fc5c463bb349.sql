ALTER TABLE public.wall_users ADD COLUMN IF NOT EXISTS ref_rewarded_at timestamptz;
CREATE OR REPLACE FUNCTION public.wall_claim_task(_tg bigint, _task uuid, _verified boolean)
 RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE t wall_tasks; p wall_task_progress; u wall_users; refs integer;
BEGIN
  SELECT * INTO t FROM wall_tasks WHERE id = _task AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'task_not_found'; END IF;
  SELECT * INTO u FROM wall_users WHERE tg_id = _tg FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'user_not_found'; END IF;
  SELECT * INTO p FROM wall_task_progress WHERE tg_id = _tg AND task_id = _task FOR UPDATE;
  IF p.last_claimed_at IS NOT NULL THEN
    IF t.cooldown_hours IS NULL THEN RAISE EXCEPTION 'already_done'; END IF;
    IF now() < p.last_claimed_at + make_interval(hours => t.cooldown_hours) THEN RAISE EXCEPTION 'cooldown'; END IF;
  END IF;
  IF t.kind = 'referral' THEN
    SELECT count(*) INTO refs FROM wall_users WHERE referrer_id = _tg AND ref_rewarded_at IS NOT NULL;
    IF refs < t.required THEN RAISE EXCEPTION 'not_enough_referrals'; END IF;
  ELSIF t.kind = 'wallet' THEN
    IF u.wallet_address IS NULL THEN RAISE EXCEPTION 'wallet_missing'; END IF;
  ELSE
    IF p.started_at IS NULL THEN RAISE EXCEPTION 'not_started'; END IF;
    IF NOT _verified AND now() < p.started_at + interval '10 seconds' THEN RAISE EXCEPTION 'too_fast'; END IF;
  END IF;
  INSERT INTO wall_task_progress (tg_id, task_id, started_at, last_claimed_at, claims_count)
  VALUES (_tg, _task, NULL, now(), 1)
  ON CONFLICT (tg_id, task_id) DO UPDATE
    SET last_claimed_at = now(), started_at = NULL, claims_count = wall_task_progress.claims_count + 1;
  UPDATE wall_users SET balance = balance + t.reward WHERE tg_id = _tg;
  RETURN t.reward;
END; $function$;
CREATE OR REPLACE FUNCTION public.wall_confirm_payment(_id uuid, _tx text)
 RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _ref bigint; _p wall_payments; _d smallint; _sp integer; _need bigint;
BEGIN
 SELECT * INTO _p FROM wall_payments WHERE id = _id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'no_payment'; END IF;
 IF _p.status IN ('paid','refund_due') THEN RETURN 0; END IF;
 PERFORM 1 FROM wall_users WHERE tg_id = _p.tg_id FOR UPDATE;
 IF _p.pack = 'mine_pass' THEN
  IF _p.amount_nano <> 50000000 OR _p.coins <> 0 THEN RAISE EXCEPTION 'bad_pass_payment'; END IF;
  INSERT INTO wall_mine_passes(tg_id, payment_id) VALUES (_p.tg_id, _p.id) ON CONFLICT (tg_id) DO NOTHING;
  IF FOUND THEN
    UPDATE wall_users SET mined_at = now() WHERE tg_id = _p.tg_id;
    UPDATE wall_users SET ref_rewarded_at = now() WHERE tg_id = _p.tg_id AND referrer_id IS NOT NULL
      AND ref_rewarded_at IS NULL AND coalesce(wallet_address,'') <> '' RETURNING referrer_id INTO _ref;
    IF _ref IS NOT NULL THEN UPDATE wall_users SET balance = balance + 100 WHERE tg_id = _ref; END IF;
  END IF;
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
END $function$;
UPDATE public.wall_tasks SET active = false WHERE kind = 'referral';