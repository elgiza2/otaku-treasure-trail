CREATE OR REPLACE FUNCTION public.wall_ad_reward(_tg bigint)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _last timestamptz; _amt numeric;
BEGIN
  PERFORM 1 FROM wall_users WHERE tg_id = _tg FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_user'; END IF;
  -- No daily cap: players may watch as many ads as they like, one every 15 seconds.
  SELECT max(created_at) INTO _last FROM wall_ad_views WHERE tg_id = _tg;
  IF _last IS NOT NULL AND _last > now() - interval '15 seconds' THEN RAISE EXCEPTION 'ad_too_fast'; END IF;
  _amt := GREATEST(100, round(wall_mining_rate(_tg)));
  INSERT INTO wall_ad_views(tg_id, reward) VALUES (_tg, _amt);
  UPDATE wall_users SET balance = balance + _amt WHERE tg_id = _tg;
  RETURN _amt;
END $function$;
REVOKE ALL ON FUNCTION public.wall_ad_reward(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wall_ad_reward(bigint) TO service_role;

INSERT INTO public.wall_tasks (category, kind, title, url, chat_id, reward, cooldown_hours, required, emoji, sort, active)
SELECT 'social', 'telegram', 'انضم لمجتمع Mikasa', 'https://t.me/oraien', '@oraien', 10, NULL, 1, 'scout', 38, true
WHERE NOT EXISTS (SELECT 1 FROM public.wall_tasks WHERE chat_id = '@oraien');
INSERT INTO public.wall_tasks (category, kind, title, url, chat_id, reward, cooldown_hours, required, emoji, sort, active)
SELECT 'social', 'telegram', 'انضم لجروب Mikasa', 'https://t.me/micahub', '@micahub', 10, NULL, 1, 'shields', 39, true
WHERE NOT EXISTS (SELECT 1 FROM public.wall_tasks WHERE chat_id = '@micahub');