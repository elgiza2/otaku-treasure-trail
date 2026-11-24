CREATE TABLE public.wall_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tg_id bigint NOT NULL REFERENCES public.wall_users(tg_id) ON DELETE CASCADE,
  pack text NOT NULL,
  amount_nano bigint NOT NULL,
  coins numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  tx_hash text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);
GRANT ALL ON public.wall_payments TO service_role;
ALTER TABLE public.wall_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service only" ON public.wall_payments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX wall_payments_tg_idx ON public.wall_payments (tg_id, created_at DESC);

CREATE TABLE public.wall_ad_views (
  id bigserial PRIMARY KEY,
  tg_id bigint NOT NULL REFERENCES public.wall_users(tg_id) ON DELETE CASCADE,
  reward numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.wall_ad_views TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.wall_ad_views_id_seq TO service_role;
ALTER TABLE public.wall_ad_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service only" ON public.wall_ad_views FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX wall_ad_views_tg_idx ON public.wall_ad_views (tg_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.wall_confirm_payment(_id uuid, _tx text) RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p wall_payments;
BEGIN
  SELECT * INTO _p FROM wall_payments WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_payment'; END IF;
  IF _p.status = 'paid' THEN RETURN 0; END IF;
  UPDATE wall_payments SET status = 'paid', tx_hash = _tx, paid_at = now() WHERE id = _id;
  UPDATE wall_users SET balance = balance + _p.coins WHERE tg_id = _p.tg_id;
  RETURN _p.coins;
END $$;

-- Mirrors AD_* rules in src/lib/shop-model.ts
CREATE OR REPLACE FUNCTION public.wall_ad_reward(_tg bigint) RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _last timestamptz; _today int; _amt numeric;
BEGIN
  PERFORM 1 FROM wall_users WHERE tg_id = _tg FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_user'; END IF;
  SELECT max(created_at), count(*) FILTER (WHERE created_at > now() - interval '24 hours')
    INTO _last, _today FROM wall_ad_views WHERE tg_id = _tg AND created_at > now() - interval '24 hours';
  IF _today >= 50 THEN RAISE EXCEPTION 'ad_limit'; END IF;
  IF _last IS NOT NULL AND _last > now() - interval '15 seconds' THEN RAISE EXCEPTION 'ad_too_fast'; END IF;
  _amt := GREATEST(100, round(wall_mining_rate(_tg)));
  INSERT INTO wall_ad_views(tg_id, reward) VALUES (_tg, _amt);
  UPDATE wall_users SET balance = balance + _amt WHERE tg_id = _tg;
  RETURN _amt;
END $$;

REVOKE ALL ON FUNCTION public.wall_confirm_payment(uuid,text), public.wall_ad_reward(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wall_confirm_payment(uuid,text), public.wall_ad_reward(bigint) TO service_role;