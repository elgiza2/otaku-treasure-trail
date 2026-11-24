ALTER FUNCTION public.wall_tournament_prize(integer) SET search_path TO 'public';

REVOKE ALL ON FUNCTION public.wall_ad_reward_v2(bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wall_ad_reward_v2(bigint, text) TO service_role;

REVOKE ALL ON FUNCTION public.wall_add_tournament_points(bigint, integer, boolean, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wall_add_tournament_points(bigint, integer, boolean, boolean) TO service_role;

REVOKE ALL ON FUNCTION public.wall_ensure_active_tournament() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wall_ensure_active_tournament() TO service_role;

CREATE INDEX IF NOT EXISTS idx_wall_tournament_entries_tg_id
  ON public.wall_tournament_entries (tg_id);