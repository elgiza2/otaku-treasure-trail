CREATE POLICY "server only" ON public.wall_raid_state FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "server only" ON public.wall_raids FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "server only" ON public.wall_vault FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);