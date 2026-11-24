ALTER TABLE public.wall_story_state ADD COLUMN IF NOT EXISTS blades integer NOT NULL DEFAULT 0;

CREATE TABLE public.wall_novel_runs (
  tg_id bigint NOT NULL,
  day date NOT NULL DEFAULT current_date,
  ending text NOT NULL,
  coins bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tg_id, day)
);
GRANT ALL ON public.wall_novel_runs TO service_role;
ALTER TABLE public.wall_novel_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wall_novel_runs server only" ON public.wall_novel_runs FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.wall_novel_finish(_tg bigint, _ending text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c bigint;
BEGIN
  _c := CASE _ending WHEN 'fall' THEN 500 WHEN 'escape' THEN 1500 WHEN 'hero' THEN 3000 WHEN 'legend' THEN 10000 ELSE NULL END;
  IF _c IS NULL THEN RAISE EXCEPTION 'bad_ending'; END IF;
  PERFORM 1 FROM wall_users WHERE tg_id = _tg FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_user'; END IF;
  IF EXISTS (SELECT 1 FROM wall_novel_runs WHERE tg_id = _tg AND day = current_date) THEN RAISE EXCEPTION 'already_played'; END IF;
  IF _ending = 'legend' THEN
    UPDATE wall_story_state SET blades = blades - 1 WHERE tg_id = _tg AND blades > 0;
    IF NOT FOUND THEN RAISE EXCEPTION 'no_item'; END IF;
  END IF;
  INSERT INTO wall_novel_runs(tg_id, ending, coins) VALUES (_tg, _ending, _c);
  UPDATE wall_users SET balance = balance + _c WHERE tg_id = _tg;
  RETURN jsonb_build_object('coins', _c);
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

REVOKE ALL ON FUNCTION public.wall_novel_finish(bigint,text), public.wall_confirm_payment(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wall_novel_finish(bigint,text), public.wall_confirm_payment(uuid,text) TO service_role;