ALTER TABLE public.wall_story_state ADD COLUMN hints integer NOT NULL DEFAULT 0, ADD COLUMN letters integer NOT NULL DEFAULT 0;
ALTER TABLE public.wall_story_attempts ADD COLUMN hint_used boolean NOT NULL DEFAULT false, ADD COLUMN letters_shown integer NOT NULL DEFAULT 0;

-- Spend one owned item on today's riddle. _item: 'hint' or 'letter'.
CREATE OR REPLACE FUNCTION public.wall_story_use(_tg bigint, _item text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ch smallint; _a wall_story_attempts; _s wall_story_state; _len integer;
BEGIN
  IF _item NOT IN ('hint', 'letter') THEN RAISE EXCEPTION 'bad_item'; END IF;
  _ch := wall_story_today();
  INSERT INTO wall_story_state(tg_id) VALUES (_tg) ON CONFLICT DO NOTHING;
  INSERT INTO wall_story_attempts(tg_id, day, chapter) VALUES (_tg, current_date, _ch) ON CONFLICT DO NOTHING;
  SELECT * INTO _a FROM wall_story_attempts WHERE tg_id = _tg AND day = current_date FOR UPDATE;
  SELECT * INTO _s FROM wall_story_state WHERE tg_id = _tg FOR UPDATE;
  IF _a.solved THEN RAISE EXCEPTION 'already_solved'; END IF;
  IF _item = 'hint' THEN
    IF _a.hint_used THEN RAISE EXCEPTION 'already_used'; END IF;
    IF _s.hints <= 0 THEN RAISE EXCEPTION 'no_item'; END IF;
    UPDATE wall_story_state SET hints = hints - 1 WHERE tg_id = _tg;
    UPDATE wall_story_attempts SET hint_used = true WHERE tg_id = _tg AND day = current_date;
  ELSE
    SELECT char_length(answer_norm) INTO _len FROM wall_story_chapters WHERE id = _ch;
    IF _a.letters_shown >= _len - 1 THEN RAISE EXCEPTION 'already_used'; END IF;
    IF _s.letters <= 0 THEN RAISE EXCEPTION 'no_item'; END IF;
    UPDATE wall_story_state SET letters = letters - 1 WHERE tg_id = _tg;
    UPDATE wall_story_attempts SET letters_shown = letters_shown + 1 WHERE tg_id = _tg AND day = current_date;
  END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

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
 ELSIF _p.pack IN ('story_tries_3','story_hint','story_letter') THEN
  _need := CASE _p.pack WHEN 'story_tries_3' THEN 500000000 WHEN 'story_hint' THEN 200000000 ELSE 300000000 END;
  IF _p.coins <> 0 OR _p.amount_nano <> _need THEN RAISE EXCEPTION 'bad_story_payment'; END IF;
  INSERT INTO wall_story_state(tg_id) VALUES (_p.tg_id) ON CONFLICT DO NOTHING;
  IF _p.pack = 'story_tries_3' THEN UPDATE wall_story_state SET extra_tries = extra_tries + 3 WHERE tg_id = _p.tg_id;
  ELSIF _p.pack = 'story_hint' THEN UPDATE wall_story_state SET hints = hints + 1 WHERE tg_id = _p.tg_id;
  ELSE UPDATE wall_story_state SET letters = letters + 1 WHERE tg_id = _p.tg_id; END IF;
 ELSE
  UPDATE wall_users SET balance = balance + _p.coins WHERE tg_id = _p.tg_id;
 END IF;
 UPDATE wall_payments SET status = 'paid', tx_hash = _tx, paid_at = now() WHERE id = _id;
 RETURN _p.coins;
END $$;

REVOKE ALL ON FUNCTION public.wall_story_use(bigint,text), public.wall_confirm_payment(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wall_story_use(bigint,text), public.wall_confirm_payment(uuid,text) TO service_role;