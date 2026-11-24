ALTER TABLE public.wall_novel_progress ADD COLUMN IF NOT EXISTS story jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS wall_gift_claims_tg_idx ON public.wall_gift_claims (tg_id);