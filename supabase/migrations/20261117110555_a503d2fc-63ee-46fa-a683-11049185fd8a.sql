CREATE TABLE public.wall_anime (tg_id bigint PRIMARY KEY REFERENCES public.wall_users(tg_id) ON DELETE CASCADE, balance numeric NOT NULL DEFAULT 0, claimed_at timestamptz);
GRANT ALL ON public.wall_anime TO service_role;
ALTER TABLE public.wall_anime ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.wall_withdrawals (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tg_id bigint NOT NULL REFERENCES public.wall_users(tg_id) ON DELETE CASCADE, amount numeric NOT NULL, address text NOT NULL, status text NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.wall_withdrawals TO service_role;
ALTER TABLE public.wall_withdrawals ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.wall_anime_claim(_tg bigint) RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r wall_anime; amt numeric;
BEGIN
  INSERT INTO wall_anime(tg_id) VALUES (_tg) ON CONFLICT DO NOTHING;
  SELECT * INTO r FROM wall_anime WHERE tg_id=_tg FOR UPDATE;
  IF r.claimed_at IS NOT NULL AND r.claimed_at > now() - interval '24 hours' THEN RAISE EXCEPTION 'too_early'; END IF;
  SELECT GREATEST(1, COALESCE(total_level,1)) INTO amt FROM wall_users WHERE tg_id=_tg;
  UPDATE wall_anime SET balance=balance+amt, claimed_at=now() WHERE tg_id=_tg;
  RETURN amt;
END $$;

CREATE OR REPLACE FUNCTION public.wall_anime_withdraw(_tg bigint, _amount numeric, _address text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE bal numeric; joined timestamptz; wid uuid;
BEGIN
  IF _amount < 1000 THEN RAISE EXCEPTION 'min_amount'; END IF;
  SELECT created_at INTO joined FROM wall_users WHERE tg_id=_tg;
  IF joined IS NULL OR joined > now() - interval '30 days' THEN RAISE EXCEPTION 'too_new'; END IF;
  SELECT balance INTO bal FROM wall_anime WHERE tg_id=_tg FOR UPDATE;
  IF COALESCE(bal,0) < _amount THEN RAISE EXCEPTION 'insufficient'; END IF;
  UPDATE wall_anime SET balance=balance-_amount WHERE tg_id=_tg;
  INSERT INTO wall_withdrawals(tg_id,amount,address) VALUES (_tg,_amount,_address) RETURNING id INTO wid;
  RETURN wid;
END $$;
REVOKE EXECUTE ON FUNCTION public.wall_anime_claim(bigint), public.wall_anime_withdraw(bigint,numeric,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wall_anime_claim(bigint), public.wall_anime_withdraw(bigint,numeric,text) TO service_role;