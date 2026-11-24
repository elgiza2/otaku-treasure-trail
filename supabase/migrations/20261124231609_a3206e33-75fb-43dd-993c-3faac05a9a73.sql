CREATE OR REPLACE FUNCTION public.wall_ad_reward_v2(_tg bigint, _provider text DEFAULT 'monetag')
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _amt numeric;
  _prov text := lower(coalesce(_provider, 'monetag'));
BEGIN
  IF _prov NOT IN ('adsgram', 'monetag') THEN
    RAISE EXCEPTION 'bad_ad_provider';
  END IF;
  PERFORM 1 FROM wall_users WHERE tg_id = _tg FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_user'; END IF;

  _amt := GREATEST(100, round(wall_mining_rate(_tg)));
  INSERT INTO wall_ad_views(tg_id, reward, provider) VALUES (_tg, _amt, _prov);
  UPDATE wall_users SET balance = balance + _amt WHERE tg_id = _tg;
  PERFORM wall_add_tournament_points(_tg, 10, true, false);
  RETURN _amt;
END;
$$;

REVOKE ALL ON FUNCTION public.wall_ad_reward_v2(bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wall_ad_reward_v2(bigint, text) TO service_role;