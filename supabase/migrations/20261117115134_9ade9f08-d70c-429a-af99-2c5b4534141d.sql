CREATE TABLE public.wall_admins (
  username text PRIMARY KEY,
  role text NOT NULL CHECK (role IN ('owner','tasks')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.wall_admins TO service_role;
ALTER TABLE public.wall_admins ENABLE ROW LEVEL SECURITY;
INSERT INTO public.wall_admins (username, role) VALUES ('eigiza','owner'), ('torker','owner') ON CONFLICT DO NOTHING;