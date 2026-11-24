CREATE TABLE public.wall_mine_passes (
 tg_id bigint PRIMARY KEY REFERENCES public.wall_users(tg_id) ON DELETE CASCADE,
 pass_number bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 payment_id uuid NOT NULL UNIQUE REFERENCES public.wall_payments(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.wall_mine_passes TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.wall_mine_passes_pass_number_seq TO service_role;
ALTER TABLE public.wall_mine_passes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service only" ON public.wall_mine_passes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE OR REPLACE FUNCTION public.wall_confirm_payment(_id uuid, _tx text) RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p wall_payments;
BEGIN
 SELECT * INTO _p FROM wall_payments WHERE id = _id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'no_payment'; END IF;
 IF _p.status = 'paid' THEN RETURN 0; END IF;
 PERFORM 1 FROM wall_users WHERE tg_id = _p.tg_id FOR UPDATE;
 IF _p.pack = 'mine_pass' THEN
  IF _p.amount_nano <> 50000000 OR _p.coins <> 0 THEN RAISE EXCEPTION 'bad_pass_payment'; END IF;
  INSERT INTO wall_mine_passes(tg_id, payment_id) VALUES (_p.tg_id, _p.id) ON CONFLICT (tg_id) DO NOTHING;
  IF FOUND THEN UPDATE wall_users SET mined_at = now() WHERE tg_id = _p.tg_id; END IF;
 ELSE
  UPDATE wall_users SET balance = balance + _p.coins WHERE tg_id = _p.tg_id;
 END IF;
 UPDATE wall_payments SET status = 'paid', tx_hash = _tx, paid_at = now() WHERE id = _id;
 RETURN _p.coins;
END $$;
CREATE OR REPLACE FUNCTION public.wall_mining_claim(_tg bigint) RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _at timestamptz; _hrs numeric; _amt numeric;
BEGIN
 PERFORM wall_ensure_heroes(_tg);
 SELECT mined_at INTO _at FROM wall_users WHERE tg_id = _tg FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'no_user'; END IF;
 IF NOT EXISTS (SELECT 1 FROM wall_mine_passes WHERE tg_id = _tg) THEN RETURN 0; END IF;
 _hrs := LEAST(3, GREATEST(0, EXTRACT(EPOCH FROM now() - _at) / 3600.0));
 _amt := round(wall_mining_rate(_tg) * _hrs, 2);
 UPDATE wall_users SET balance = balance + _amt, mined_at = now() WHERE tg_id = _tg;
 RETURN _amt;
END $$;
REVOKE ALL ON FUNCTION public.wall_confirm_payment(uuid,text), public.wall_mining_claim(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wall_confirm_payment(uuid,text), public.wall_mining_claim(bigint) TO service_role;