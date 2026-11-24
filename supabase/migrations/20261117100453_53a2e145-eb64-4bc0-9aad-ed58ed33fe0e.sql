CREATE TABLE public.wall_defense_state (
  tg_id bigint PRIMARY KEY REFERENCES public.wall_users(tg_id) ON DELETE CASCADE,
  runs integer NOT NULL DEFAULT 3,
  runs_at timestamptz NOT NULL DEFAULT now(),
  best integer NOT NULL DEFAULT 0,
  plays integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.wall_defense_state TO service_role;
ALTER TABLE public.wall_defense_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "server only" ON public.wall_defense_state FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Free runs: max 3, +1 per 8 hours (mirrors regenRuns in defense-model.ts)
CREATE OR REPLACE FUNCTION public.wall_defense_load(_tg bigint) RETURNS wall_defense_state
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _s wall_defense_state; _h integer;
BEGIN
  INSERT INTO wall_defense_state(tg_id) VALUES (_tg) ON CONFLICT DO NOTHING;
  SELECT * INTO _s FROM wall_defense_state WHERE tg_id = _tg FOR UPDATE;
  IF _s.runs >= 3 THEN
    UPDATE wall_defense_state SET runs_at = now() WHERE tg_id = _tg RETURNING * INTO _s;
  ELSE
    _h := floor(extract(epoch FROM now() - _s.runs_at) / 28800)::int;
    IF _h > 0 THEN
      UPDATE wall_defense_state SET runs = LEAST(3, runs + _h),
        runs_at = CASE WHEN runs + _h >= 3 THEN now() ELSE runs_at + make_interval(hours => _h * 8) END
      WHERE tg_id = _tg RETURNING * INTO _s;
    END IF;
  END IF;
  RETURN _s;
END $$;

-- One finished run. The server alone sets the payout: never negative, never above 15000.
CREATE OR REPLACE FUNCTION public.wall_defense_play(_tg bigint, _score integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _s wall_defense_state; _sc integer; _best integer;
BEGIN
  _s := wall_defense_load(_tg);
  IF _s.runs <= 0 THEN RAISE EXCEPTION 'no_runs'; END IF;
  _sc := COALESCE(_score, 0);
  IF _sc < 0 THEN _sc := 0; END IF;
  IF _sc > 15000 THEN _sc := 15000; END IF;
  _best := GREATEST(_s.best, _sc);
  UPDATE wall_defense_state
     SET runs = runs - 1, plays = plays + 1, best = _best,
         runs_at = CASE WHEN runs >= 3 THEN now() ELSE runs_at END
   WHERE tg_id = _tg;
  IF _sc > 0 THEN UPDATE wall_users SET balance = balance + _sc WHERE tg_id = _tg; END IF;
  UPDATE wall_vault SET pot = pot + 100 WHERE id = 1;
  RETURN jsonb_build_object('coins', _sc, 'runs', _s.runs - 1, 'best', _best);
END $$;

-- TON run packs: amounts mirror RUN_PACKS in defense-model.ts
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
 ELSIF _p.pack = 'runs_3' THEN
  IF _p.coins <> 0 OR _p.amount_nano <> 500000000 THEN RAISE EXCEPTION 'bad_run_payment'; END IF;
  INSERT INTO wall_defense_state(tg_id) VALUES (_p.tg_id) ON CONFLICT DO NOTHING;
  UPDATE wall_defense_state SET runs = runs + 3 WHERE tg_id = _p.tg_id;
 ELSE
  UPDATE wall_users SET balance = balance + _p.coins WHERE tg_id = _p.tg_id;
 END IF;
 UPDATE wall_payments SET status = 'paid', tx_hash = _tx, paid_at = now() WHERE id = _id;
 RETURN _p.coins;
END $$;

REVOKE ALL ON FUNCTION public.wall_defense_load(bigint), public.wall_defense_play(bigint,integer), public.wall_confirm_payment(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wall_defense_load(bigint), public.wall_defense_play(bigint,integer), public.wall_confirm_payment(uuid,text) TO service_role;