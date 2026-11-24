-- 1. Extend existing tables
ALTER TABLE public.wall_users
  ADD COLUMN IF NOT EXISTS gram_balance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ref_tournament_rewarded_at timestamptz;

ALTER TABLE public.wall_ad_views
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'monetag';

-- 2. Tournament rounds table
CREATE TABLE IF NOT EXISTS public.wall_tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_number integer NOT NULL UNIQUE,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL DEFAULT (now() + interval '3 days'),
  prize_pool numeric NOT NULL DEFAULT 350,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'settled')),
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.wall_tournaments TO anon, authenticated;
GRANT ALL ON public.wall_tournaments TO service_role;
ALTER TABLE public.wall_tournaments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view tournaments" ON public.wall_tournaments;
CREATE POLICY "Public can view tournaments"
  ON public.wall_tournaments
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- 3. Tournament entries table
CREATE TABLE IF NOT EXISTS public.wall_tournament_entries (
  tournament_id uuid NOT NULL REFERENCES public.wall_tournaments(id) ON DELETE CASCADE,
  tg_id bigint NOT NULL REFERENCES public.wall_users(tg_id) ON DELETE CASCADE,
  points integer NOT NULL DEFAULT 0,
  ads_count integer NOT NULL DEFAULT 0,
  referrals_count integer NOT NULL DEFAULT 0,
  prize_gram numeric NOT NULL DEFAULT 0,
  final_rank integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tournament_id, tg_id)
);

CREATE INDEX IF NOT EXISTS idx_wall_tournament_entries_rank
  ON public.wall_tournament_entries (tournament_id, points DESC, updated_at ASC);

GRANT SELECT ON public.wall_tournament_entries TO anon, authenticated;
GRANT ALL ON public.wall_tournament_entries TO service_role;
ALTER TABLE public.wall_tournament_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view tournament entries" ON public.wall_tournament_entries;
CREATE POLICY "Public can view tournament entries"
  ON public.wall_tournament_entries
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- 4. Prize table function (350 GRAM total for Top 20)
CREATE OR REPLACE FUNCTION public.wall_tournament_prize(_rank integer)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN _rank = 1 THEN 120
    WHEN _rank = 2 THEN 70
    WHEN _rank = 3 THEN 40
    WHEN _rank BETWEEN 4 AND 10 THEN 10
    WHEN _rank BETWEEN 11 AND 20 THEN 5
    ELSE 0
  END::numeric;
$$;

-- 5. Settle expired rounds and guarantee an active 3-day round
CREATE OR REPLACE FUNCTION public.wall_ensure_active_tournament()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _expired record;
  _active_id uuid;
  _next_round integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('wall_tournament_cycle'));

  FOR _expired IN
    SELECT id FROM wall_tournaments
    WHERE status = 'active' AND ends_at <= now()
    ORDER BY round_number ASC
    FOR UPDATE
  LOOP
    WITH ranked AS (
      SELECT
        tg_id,
        ROW_NUMBER() OVER (ORDER BY points DESC, updated_at ASC, tg_id ASC)::integer AS rnk
      FROM wall_tournament_entries
      WHERE tournament_id = _expired.id AND points > 0
    ),
    updated AS (
      UPDATE wall_tournament_entries e
      SET
        final_rank = r.rnk,
        prize_gram = wall_tournament_prize(r.rnk)
      FROM ranked r
      WHERE e.tournament_id = _expired.id AND e.tg_id = r.tg_id
      RETURNING e.tg_id, e.prize_gram
    )
    UPDATE wall_users u
    SET gram_balance = u.gram_balance + up.prize_gram
    FROM updated up
    WHERE u.tg_id = up.tg_id AND up.prize_gram > 0;

    UPDATE wall_tournaments
    SET status = 'settled', settled_at = now()
    WHERE id = _expired.id;
  END LOOP;

  SELECT id INTO _active_id
  FROM wall_tournaments
  WHERE status = 'active' AND ends_at > now()
  ORDER BY round_number DESC
  LIMIT 1;

  IF _active_id IS NULL THEN
    SELECT COALESCE(MAX(round_number), 0) + 1 INTO _next_round FROM wall_tournaments;
    INSERT INTO wall_tournaments (round_number, starts_at, ends_at, prize_pool, status)
    VALUES (_next_round, now(), now() + interval '3 days', 350, 'active')
    RETURNING id INTO _active_id;
  END IF;

  RETURN _active_id;
END;
$$;

-- 6. Award tournament points helper
CREATE OR REPLACE FUNCTION public.wall_add_tournament_points(
  _tg bigint,
  _points integer,
  _is_ad boolean DEFAULT false,
  _is_ref boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tid uuid;
BEGIN
  IF _points <= 0 THEN RETURN NULL; END IF;
  _tid := wall_ensure_active_tournament();
  INSERT INTO wall_tournament_entries (tournament_id, tg_id, points, ads_count, referrals_count, updated_at)
  VALUES (
    _tid,
    _tg,
    _points,
    CASE WHEN _is_ad THEN 1 ELSE 0 END,
    CASE WHEN _is_ref THEN 1 ELSE 0 END,
    now()
  )
  ON CONFLICT (tournament_id, tg_id) DO UPDATE
  SET
    points = wall_tournament_entries.points + EXCLUDED.points,
    ads_count = wall_tournament_entries.ads_count + EXCLUDED.ads_count,
    referrals_count = wall_tournament_entries.referrals_count + EXCLUDED.referrals_count,
    updated_at = now();
  RETURN _tid;
END;
$$;

-- 7. Dual-provider ad reward (Adsgram + Monetag run in parallel with separate 15s cooldowns + 10 tournament points)
CREATE OR REPLACE FUNCTION public.wall_ad_reward_v2(_tg bigint, _provider text DEFAULT 'monetag')
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _last timestamptz;
  _amt numeric;
  _prov text := lower(coalesce(_provider, 'monetag'));
BEGIN
  IF _prov NOT IN ('adsgram', 'monetag') THEN
    RAISE EXCEPTION 'bad_ad_provider';
  END IF;
  PERFORM 1 FROM wall_users WHERE tg_id = _tg FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_user'; END IF;

  SELECT max(created_at) INTO _last
  FROM wall_ad_views
  WHERE tg_id = _tg AND provider = _prov;

  IF _last IS NOT NULL AND _last > now() - interval '15 seconds' THEN
    RAISE EXCEPTION 'ad_too_fast';
  END IF;

  _amt := GREATEST(100, round(wall_mining_rate(_tg)));
  INSERT INTO wall_ad_views(tg_id, reward, provider) VALUES (_tg, _amt, _prov);
  UPDATE wall_users SET balance = balance + _amt WHERE tg_id = _tg;
  PERFORM wall_add_tournament_points(_tg, 10, true, false);
  RETURN _amt;
END;
$$;

CREATE OR REPLACE FUNCTION public.wall_ad_reward(_tg bigint)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN wall_ad_reward_v2(_tg, 'monetag');
END;
$$;

-- 8. Update wall_confirm_payment so 0.05 TON mine_pass verification awards +100 tournament points to referrer
CREATE OR REPLACE FUNCTION public.wall_confirm_payment(_id uuid, _tx text)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _ref bigint; _tref bigint; _p wall_payments; _d smallint; _sp integer; _need bigint;
BEGIN
 SELECT * INTO _p FROM wall_payments WHERE id = _id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'no_payment'; END IF;
 IF _p.status IN ('paid','refund_due') THEN RETURN 0; END IF;
 PERFORM 1 FROM wall_users WHERE tg_id = _p.tg_id FOR UPDATE;
 IF _p.pack = 'mine_pass' THEN
  IF _p.amount_nano <> 50000000 OR _p.coins <> 0 THEN RAISE EXCEPTION 'bad_pass_payment'; END IF;
  INSERT INTO wall_mine_passes(tg_id, payment_id) VALUES (_p.tg_id, _p.id) ON CONFLICT (tg_id) DO NOTHING;
  IF FOUND THEN
    UPDATE wall_users SET mined_at = now() WHERE tg_id = _p.tg_id;
    UPDATE wall_users SET ref_rewarded_at = now() WHERE tg_id = _p.tg_id AND referrer_id IS NOT NULL
      AND ref_rewarded_at IS NULL AND coalesce(wallet_address,'') <> '' RETURNING referrer_id INTO _ref;
    IF _ref IS NOT NULL THEN UPDATE wall_users SET balance = balance + 100 WHERE tg_id = _ref; END IF;
    UPDATE wall_users SET ref_tournament_rewarded_at = now() WHERE tg_id = _p.tg_id AND referrer_id IS NOT NULL
      AND ref_tournament_rewarded_at IS NULL RETURNING referrer_id INTO _tref;
    IF _tref IS NOT NULL THEN PERFORM wall_add_tournament_points(_tref, 100, false, true); END IF;
  END IF;
 ELSIF _p.pack = 'nft_mint' THEN
  IF _p.amount_nano <> 5000000000 OR _p.coins <> 0 THEN RAISE EXCEPTION 'bad_nft_payment'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('wall_nft_mint'));
  _d := wall_nft_pick(random());
  IF _d IS NULL THEN
   UPDATE wall_payments SET status = 'refund_due', tx_hash = _tx, paid_at = now() WHERE id = _id;
   RETURN 0;
  END IF;
  INSERT INTO wall_nfts(tg_id, design, payment_id) VALUES (_p.tg_id, _d, _p.id) ON CONFLICT (payment_id) DO NOTHING;
 ELSIF _p.pack IN ('spins_20','spins_60','spins_250') THEN
  _sp := CASE _p.pack WHEN 'spins_20' THEN 20 WHEN 'spins_60' THEN 60 WHEN 'spins_250' THEN 250 END;
  _need := CASE _p.pack WHEN 'spins_20' THEN 500000000 WHEN 'spins_60' THEN 1000000000 ELSE 3000000000 END;
  IF _p.coins <> 0 OR _p.amount_nano <> _need THEN RAISE EXCEPTION 'bad_spin_payment'; END IF;
  INSERT INTO wall_raid_state(tg_id) VALUES (_p.tg_id) ON CONFLICT DO NOTHING;
  UPDATE wall_raid_state SET spins = spins + _sp WHERE tg_id = _p.tg_id;
 ELSIF _p.pack = 'novel_plays_5' THEN
  IF _p.coins <> 0 OR _p.amount_nano <> 300000000 THEN RAISE EXCEPTION 'bad_novel_payment'; END IF;
  PERFORM wall_novel_row(_p.tg_id);
  UPDATE wall_novel_progress SET bonus_plays = bonus_plays + 5 WHERE tg_id = _p.tg_id;
 ELSIF _p.pack IN ('story_tries_3','story_hint','story_letter','story_blade') THEN
  _need := CASE _p.pack WHEN 'story_tries_3' THEN 500000000 WHEN 'story_hint' THEN 200000000 WHEN 'story_blade' THEN 400000000 ELSE 300000000 END;
  IF _p.coins <> 0 OR _p.amount_nano <> _need THEN RAISE EXCEPTION 'bad_story_payment'; END IF;
  INSERT INTO wall_story_state(tg_id) VALUES (_p.tg_id) ON CONFLICT DO NOTHING;
  IF _p.pack = 'story_tries_3' THEN UPDATE wall_story_state SET extra_tries = extra_tries + 3 WHERE tg_id = _p.tg_id;
  ELSIF _p.pack = 'story_hint' THEN UPDATE wall_story_state SET hints = hints + 1 WHERE tg_id = _p.tg_id;
  ELSIF _p.pack = 'story_blade' THEN UPDATE wall_story_state SET blades = blades + 1 WHERE tg_id = _p.tg_id;
  ELSE UPDATE wall_story_state SET letters = letters + 1 WHERE tg_id = _p.tg_id; END IF;
 ELSE
  UPDATE wall_users SET balance = balance + _p.coins WHERE tg_id = _p.tg_id;
 END IF;
 UPDATE wall_payments SET status = 'paid', tx_hash = _tx, paid_at = now() WHERE id = _id;
 RETURN _p.coins;
END;
$$;

-- 9. Start Round #1 immediately
SELECT public.wall_ensure_active_tournament();