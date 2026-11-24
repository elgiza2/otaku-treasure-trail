CREATE OR REPLACE FUNCTION public.wall_anime_withdraw(_tg bigint, _amount numeric, _address text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE bal numeric; joined timestamptz; wid uuid;
BEGIN
  IF _amount < 10000 THEN RAISE EXCEPTION 'min_amount'; END IF;
  SELECT created_at INTO joined FROM wall_users WHERE tg_id=_tg;
  IF joined IS NULL OR joined > now() - interval '30 days' THEN RAISE EXCEPTION 'too_new'; END IF;
  SELECT balance INTO bal FROM wall_anime WHERE tg_id=_tg FOR UPDATE;
  IF COALESCE(bal,0) < _amount THEN RAISE EXCEPTION 'insufficient'; END IF;
  UPDATE wall_anime SET balance=balance-_amount WHERE tg_id=_tg;
  INSERT INTO wall_withdrawals(tg_id,amount,address) VALUES (_tg,_amount,_address) RETURNING id INTO wid;
  RETURN wid;
END $$;