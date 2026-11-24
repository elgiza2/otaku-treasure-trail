ALTER TABLE public.wall_users ADD COLUMN IF NOT EXISTS notified_slot text, ADD COLUMN IF NOT EXISTS bot_blocked boolean NOT NULL DEFAULT false;

CREATE TABLE public.wall_gifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount numeric NOT NULL CHECK (amount > 0),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.wall_gifts TO service_role;
ALTER TABLE public.wall_gifts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.wall_gift_claims (
  gift_id uuid NOT NULL REFERENCES public.wall_gifts(id) ON DELETE CASCADE,
  tg_id bigint NOT NULL REFERENCES public.wall_users(tg_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (gift_id, tg_id)
);
GRANT ALL ON public.wall_gift_claims TO service_role;
ALTER TABLE public.wall_gift_claims ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.wall_jobs (
  name text PRIMARY KEY,
  locked_until timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.wall_jobs TO service_role;
ALTER TABLE public.wall_jobs ENABLE ROW LEVEL SECURITY;

-- Single-flight lease: returns true only for the one caller that takes it.
CREATE OR REPLACE FUNCTION public.wall_job_lock(_name text, _seconds integer) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO wall_jobs(name, locked_until) VALUES (_name, now() + make_interval(secs => _seconds))
  ON CONFLICT (name) DO UPDATE SET locked_until = EXCLUDED.locked_until WHERE wall_jobs.locked_until < now();
  RETURN FOUND;
END $$;

-- Today's gift (one per UTC day), created on demand.
CREATE OR REPLACE FUNCTION public.wall_today_gift(_amount numeric) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE gid uuid;
BEGIN
  SELECT id INTO gid FROM wall_gifts WHERE created_at >= date_trunc('day', now()) ORDER BY created_at LIMIT 1;
  IF gid IS NULL THEN
    INSERT INTO wall_gifts(amount, expires_at) VALUES (_amount, date_trunc('day', now()) + interval '1 day') RETURNING id INTO gid;
  END IF;
  RETURN gid;
END $$;

-- Claim a chat gift once; credits in-game coins.
CREATE OR REPLACE FUNCTION public.wall_claim_gift(_gift uuid, _tg bigint) RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE g wall_gifts;
BEGIN
  SELECT * INTO g FROM wall_gifts WHERE id = _gift;
  IF g.id IS NULL THEN RAISE EXCEPTION 'gift_not_found'; END IF;
  IF g.expires_at < now() THEN RAISE EXCEPTION 'gift_expired'; END IF;
  IF NOT EXISTS (SELECT 1 FROM wall_users WHERE tg_id = _tg) THEN RAISE EXCEPTION 'no_user'; END IF;
  INSERT INTO wall_gift_claims(gift_id, tg_id) VALUES (_gift, _tg) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RAISE EXCEPTION 'gift_claimed'; END IF;
  UPDATE wall_users SET balance = balance + g.amount WHERE tg_id = _tg;
  RETURN g.amount;
END $$;

REVOKE ALL ON FUNCTION public.wall_job_lock(text, integer), public.wall_today_gift(numeric), public.wall_claim_gift(uuid, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wall_job_lock(text, integer), public.wall_today_gift(numeric), public.wall_claim_gift(uuid, bigint) TO service_role;