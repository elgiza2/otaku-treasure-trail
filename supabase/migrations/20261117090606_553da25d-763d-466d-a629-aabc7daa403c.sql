CREATE TABLE public.wall_nfts (
 serial bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 tg_id bigint NOT NULL REFERENCES public.wall_users(tg_id) ON DELETE CASCADE,
 design smallint NOT NULL CHECK (design BETWEEN 1 AND 4),
 payment_id uuid NOT NULL UNIQUE REFERENCES public.wall_payments(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.wall_nfts TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.wall_nfts_serial_seq TO service_role;
ALTER TABLE public.wall_nfts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service only" ON public.wall_nfts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX wall_nfts_tg_idx ON public.wall_nfts (tg_id, serial DESC);

-- Mirrors NFT_DESIGNS weights in src/lib/nft-model.ts (50/30/15/5).
CREATE OR REPLACE FUNCTION public.wall_nft_roll(_r double precision) RETURNS smallint
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
 SELECT (CASE WHEN _r < 0.50 THEN 1 WHEN _r < 0.80 THEN 2 WHEN _r < 0.95 THEN 3 ELSE 4 END)::smallint
$$;

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
 ELSIF _p.pack = 'nft_mint' THEN
  IF _p.amount_nano <> 5000000000 OR _p.coins <> 0 THEN RAISE EXCEPTION 'bad_nft_payment'; END IF;
  INSERT INTO wall_nfts(tg_id, design, payment_id) VALUES (_p.tg_id, wall_nft_roll(random()), _p.id) ON CONFLICT (payment_id) DO NOTHING;
 ELSE
  UPDATE wall_users SET balance = balance + _p.coins WHERE tg_id = _p.tg_id;
 END IF;
 UPDATE wall_payments SET status = 'paid', tx_hash = _tx, paid_at = now() WHERE id = _id;
 RETURN _p.coins;
END $$;
REVOKE ALL ON FUNCTION public.wall_confirm_payment(uuid,text), public.wall_nft_roll(double precision) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wall_confirm_payment(uuid,text), public.wall_nft_roll(double precision) TO service_role;