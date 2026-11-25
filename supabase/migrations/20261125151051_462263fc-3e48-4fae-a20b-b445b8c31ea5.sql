DROP TABLE IF EXISTS public.wall_user_task_orders;

CREATE INDEX IF NOT EXISTS idx_wall_tasks_creator_tg_id ON public.wall_tasks (creator_tg_id);

CREATE OR REPLACE FUNCTION public.wall_confirm_payment(_id uuid, _tx text)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _ref bigint; _tref bigint; _p wall_payments; _d smallint; _sp integer; _need bigint;
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
    UPDATE wall_users SET ref_tournament_rewarded_at = now() WHERE tg_id = _p.tg_id AND referrer_id IS NOT NULL
      AND ref_tournament_rewarded_at IS NULL RETURNING referrer_id INTO _tref;
    IF _tref IS NOT NULL THEN PERFORM wall_add_tournament_points(_tref, 100, false, true); END IF;
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
 ELSIF _p.pack = 'user_task_1000' THEN
  IF _p.coins <> 0 OR _p.amount_nano <> 1000000000 THEN RAISE EXCEPTION 'bad_task_payment'; END IF;
 ELSE
  UPDATE wall_users SET balance = balance + _p.coins WHERE tg_id = _p.tg_id;
 END IF;
 UPDATE wall_payments SET status = 'paid', tx_hash = _tx, paid_at = now() WHERE id = _id;
 RETURN _p.coins;
END;
$function$;

CREATE OR REPLACE FUNCTION public.wall_publish_user_task(_tg bigint, _payment_id uuid, _title text, _url text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _p wall_payments; _task_id uuid;
BEGIN
  SELECT * INTO _p FROM wall_payments WHERE id = _payment_id AND tg_id = _tg FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_payment'; END IF;
  IF _p.pack <> 'user_task_1000' OR _p.amount_nano <> 1000000000 THEN RAISE EXCEPTION 'bad_task_payment'; END IF;
  IF _p.status <> 'paid' THEN RAISE EXCEPTION 'payment_not_paid'; END IF;
  IF EXISTS (SELECT 1 FROM wall_tasks WHERE payment_id = _payment_id) THEN RAISE EXCEPTION 'task_already_published'; END IF;
  INSERT INTO wall_tasks (category, kind, title, url, reward, cooldown_hours, required, emoji, sort, active, creator_tg_id, payment_id, max_claims, claims_done)
  VALUES ('partners', 'link', btrim(_title), btrim(_url), 5, NULL, 1, 'sparkle', 50, true, _tg, _payment_id, 1000, 0)
  RETURNING id INTO _task_id;
  RETURN _task_id;
END;
$function$;