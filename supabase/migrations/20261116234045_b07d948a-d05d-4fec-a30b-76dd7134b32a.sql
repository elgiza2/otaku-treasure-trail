
CREATE TABLE public.wall_users (
  tg_id bigint PRIMARY KEY,
  username text,
  first_name text NOT NULL DEFAULT '',
  photo_url text,
  balance numeric NOT NULL DEFAULT 0,
  wallet_address text,
  referrer_id bigint,
  checkin_streak integer NOT NULL DEFAULT 0,
  last_checkin_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wall_users_referrer_idx ON public.wall_users (referrer_id);
GRANT ALL ON public.wall_users TO service_role;
ALTER TABLE public.wall_users ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.wall_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT 'partners',
  kind text NOT NULL DEFAULT 'link',
  title text NOT NULL,
  url text,
  chat_id text,
  reward numeric NOT NULL DEFAULT 5,
  cooldown_hours integer,
  required integer NOT NULL DEFAULT 1,
  emoji text NOT NULL DEFAULT 'sparkle',
  sort integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wall_tasks TO anon, authenticated;
GRANT ALL ON public.wall_tasks TO service_role;
ALTER TABLE public.wall_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can see active tasks" ON public.wall_tasks FOR SELECT TO anon, authenticated USING (active = true);

CREATE TABLE public.wall_task_progress (
  tg_id bigint NOT NULL REFERENCES public.wall_users(tg_id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.wall_tasks(id) ON DELETE CASCADE,
  started_at timestamptz,
  last_claimed_at timestamptz,
  claims_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (tg_id, task_id)
);
GRANT ALL ON public.wall_task_progress TO service_role;
ALTER TABLE public.wall_task_progress ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.wall_checkins (
  id bigserial PRIMARY KEY,
  tg_id bigint NOT NULL REFERENCES public.wall_users(tg_id) ON DELETE CASCADE,
  streak_day integer NOT NULL,
  reward numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wall_checkins_user_idx ON public.wall_checkins (tg_id, created_at DESC);
GRANT ALL ON public.wall_checkins TO service_role;
GRANT USAGE ON SEQUENCE public.wall_checkins_id_seq TO service_role;
ALTER TABLE public.wall_checkins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.wall_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER wall_tasks_touch BEFORE UPDATE ON public.wall_tasks
FOR EACH ROW EXECUTE FUNCTION public.wall_touch_updated_at();

-- Register or refresh a player. The inviter is only set on first visit.
CREATE OR REPLACE FUNCTION public.wall_upsert_user(_tg bigint, _username text, _first text, _photo text, _ref bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO wall_users (tg_id, username, first_name, photo_url, referrer_id)
  VALUES (_tg, _username, coalesce(_first, ''), _photo,
          CASE WHEN _ref IS NOT NULL AND _ref <> _tg AND EXISTS (SELECT 1 FROM wall_users WHERE tg_id = _ref) THEN _ref END)
  ON CONFLICT (tg_id) DO UPDATE
    SET username = EXCLUDED.username, first_name = EXCLUDED.first_name,
        photo_url = EXCLUDED.photo_url, last_seen_at = now();
END; $$;

-- Daily check-in: 7-day cycle (+5 … +11). Claimable every 24h; missing more than 48h restarts the streak.
CREATE OR REPLACE FUNCTION public.wall_daily_checkin(_tg bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u wall_users; d integer; r numeric;
BEGIN
  SELECT * INTO u FROM wall_users WHERE tg_id = _tg FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'user_not_found'; END IF;
  IF u.last_checkin_at IS NOT NULL AND now() < u.last_checkin_at + interval '24 hours' THEN
    RAISE EXCEPTION 'too_early';
  END IF;
  IF u.last_checkin_at IS NULL OR now() > u.last_checkin_at + interval '48 hours' THEN
    d := 1;
  ELSE
    d := (u.checkin_streak % 7) + 1;
  END IF;
  r := 4 + d;
  UPDATE wall_users SET checkin_streak = d, last_checkin_at = now(), balance = balance + r WHERE tg_id = _tg;
  INSERT INTO wall_checkins (tg_id, streak_day, reward) VALUES (_tg, d, r);
  RETURN jsonb_build_object('streak_day', d, 'reward', r);
END; $$;

CREATE OR REPLACE FUNCTION public.wall_start_task(_tg bigint, _task uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM wall_tasks WHERE id = _task AND active) THEN RAISE EXCEPTION 'task_not_found'; END IF;
  INSERT INTO wall_task_progress (tg_id, task_id, started_at) VALUES (_tg, _task, now())
  ON CONFLICT (tg_id, task_id) DO UPDATE SET started_at = coalesce(wall_task_progress.started_at, now());
END; $$;

-- Claim a task reward. _verified = the server confirmed channel membership.
CREATE OR REPLACE FUNCTION public.wall_claim_task(_tg bigint, _task uuid, _verified boolean)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t wall_tasks; p wall_task_progress; u wall_users; refs integer;
BEGIN
  SELECT * INTO t FROM wall_tasks WHERE id = _task AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'task_not_found'; END IF;
  SELECT * INTO u FROM wall_users WHERE tg_id = _tg FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'user_not_found'; END IF;
  SELECT * INTO p FROM wall_task_progress WHERE tg_id = _tg AND task_id = _task FOR UPDATE;

  IF p.last_claimed_at IS NOT NULL THEN
    IF t.cooldown_hours IS NULL THEN RAISE EXCEPTION 'already_done'; END IF;
    IF now() < p.last_claimed_at + make_interval(hours => t.cooldown_hours) THEN RAISE EXCEPTION 'cooldown'; END IF;
  END IF;

  IF t.kind = 'referral' THEN
    SELECT count(*) INTO refs FROM wall_users WHERE referrer_id = _tg;
    IF refs < t.required THEN RAISE EXCEPTION 'not_enough_referrals'; END IF;
  ELSIF t.kind = 'wallet' THEN
    IF u.wallet_address IS NULL THEN RAISE EXCEPTION 'wallet_missing'; END IF;
  ELSE
    IF p.started_at IS NULL THEN RAISE EXCEPTION 'not_started'; END IF;
    IF NOT _verified AND now() < p.started_at + interval '10 seconds' THEN RAISE EXCEPTION 'too_fast'; END IF;
  END IF;

  INSERT INTO wall_task_progress (tg_id, task_id, started_at, last_claimed_at, claims_count)
  VALUES (_tg, _task, NULL, now(), 1)
  ON CONFLICT (tg_id, task_id) DO UPDATE
    SET last_claimed_at = now(), started_at = NULL, claims_count = wall_task_progress.claims_count + 1;
  UPDATE wall_users SET balance = balance + t.reward WHERE tg_id = _tg;
  RETURN t.reward;
END; $$;

REVOKE ALL ON FUNCTION public.wall_upsert_user(bigint, text, text, text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wall_daily_checkin(bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wall_start_task(bigint, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wall_claim_task(bigint, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wall_upsert_user(bigint, text, text, text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.wall_daily_checkin(bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.wall_start_task(bigint, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.wall_claim_task(bigint, uuid, boolean) TO service_role;

INSERT INTO public.wall_tasks (category, kind, title, url, chat_id, reward, cooldown_hours, required, emoji, sort) VALUES
  ('onchain',  'wallet',   'اربط محفظة TON',                    NULL, NULL, 25, NULL, 1, 'wallet', 10),
  ('onchain',  'telegram', 'انضم لمجتمع TON الرسمي',            'https://t.me/toncoin', '@toncoin', 5, NULL, 1, 'ton', 20),
  ('game',     'referral', 'ادعُ أول صديق إلى الأسوار',          NULL, NULL, 20, NULL, 1, 'shields', 30),
  ('game',     'referral', 'ادعُ 5 أصدقاء',                      NULL, NULL, 100, NULL, 5, 'shields', 31),
  ('game',     'referral', 'ادعُ 25 صديقًا',                     NULL, NULL, 500, NULL, 25, 'shields', 32),
  ('social',   'share',    'شارك رابط دعوتك',                    NULL, NULL, 5, 24, 1, 'rays', 40),
  ('social',   'telegram', 'انضم لمجتمع elgiza',                 'https://t.me/elgizach', '@elgizach', 10, NULL, 1, 'scout', 41),
  ('social',   'x',        'تابع Zoomex على X',                  'https://x.com/ZoomexOfficial', NULL, 5, NULL, 1, 'globe', 42),
  ('partners', 'link',     'افتح Holo',                          'https://t.me/holoiobot?start=r6657246146', NULL, 10, NULL, 1, 'rocket', 50),
  ('partners', 'link',     'افتح $ORAI',                         'https://t.me/Starstrbot?startapp=ref_8436961304', NULL, 10, NULL, 1, 'crystal', 51),
  ('partners', 'telegram', 'انضم لقناة Promoter',               'https://t.me/web3isc', '@web3isc', 8, NULL, 1, 'scout', 52),
  ('partners', 'link',     'افتح Clau وابدأ التعدين',            'https://t.me/Clautsbot?start=r6657246146', NULL, 10, NULL, 1, 'ore', 53);
