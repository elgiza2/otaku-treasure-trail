
CREATE POLICY "Server only" ON public.wall_users FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Server only" ON public.wall_task_progress FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Server only" ON public.wall_checkins FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE INDEX wall_task_progress_task_idx ON public.wall_task_progress (task_id);
