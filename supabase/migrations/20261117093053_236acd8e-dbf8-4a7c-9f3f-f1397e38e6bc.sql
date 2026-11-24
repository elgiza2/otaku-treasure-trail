CREATE TABLE public.wall_nft_supply (
 design smallint PRIMARY KEY CHECK (design BETWEEN 1 AND 4),
 cap integer NOT NULL CHECK (cap > 0),
 reserved integer NOT NULL DEFAULT 0 CHECK (reserved >= 0 AND reserved <= cap)
);
GRANT ALL ON public.wall_nft_supply TO service_role;
ALTER TABLE public.wall_nft_supply ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service only" ON public.wall_nft_supply FOR ALL TO service_role USING (true) WITH CHECK (true);
-- Mirrors NFT_DESIGNS cap/reserved in src/lib/nft-model.ts: 10,000 total, 9,164 already taken, 836 open.
INSERT INTO public.wall_nft_supply(design, cap, reserved) VALUES (1,5000,4582),(2,3000,2749),(3,1500,1375),(4,500,458);

CREATE OR REPLACE FUNCTION public.wall_nft_remaining() RETURNS TABLE(design smallint, cap integer, remaining integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT s.design, s.cap, (s.cap - s.reserved - (SELECT count(*) FROM wall_nfts n WHERE n.design = s.design))::integer
 FROM wall_nft_supply s ORDER BY s.design
$$;

-- Picks a design weighted by remaining copies (mirrors pickFromRemaining). Null when sold out.
CREATE OR REPLACE FUNCTION public.wall_nft_pick(_r double precision) RETURNS smallint
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _total integer; _target integer; _acc integer := 0; _row record;
BEGIN
 SELECT coalesce(sum(greatest(remaining,0)),0) INTO _total FROM wall_nft_remaining();
 IF _total <= 0 THEN RETURN NULL; END IF;
 _target := floor(_r * _total)::integer;
 FOR _row IN SELECT * FROM wall_nft_remaining() LOOP
  _acc := _acc + greatest(_row.remaining,0);
  IF _target < _acc THEN RETURN _row.design; END IF;
 END LOOP;
 RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.wall_confirm_payment(_id uuid, _tx text) RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p wall_payments; _d smallint;
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
 ELSE
  UPDATE wall_users SET balance = balance + _p.coins WHERE tg_id = _p.tg_id;
 END IF;
 UPDATE wall_payments SET status = 'paid', tx_hash = _tx, paid_at = now() WHERE id = _id;
 RETURN _p.coins;
END $$;
REVOKE ALL ON FUNCTION public.wall_confirm_payment(uuid,text), public.wall_nft_pick(double precision), public.wall_nft_remaining() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wall_confirm_payment(uuid,text), public.wall_nft_pick(double precision), public.wall_nft_remaining() TO service_role;