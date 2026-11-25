DO $$ DECLARE definition text; BEGIN SELECT pg_get_functiondef('public.wall_ensure_active_tournament()'::regprocedure) INTO definition; definition:=replace(definition, 'interval ''3 days''', 'interval ''7 days'''); EXECUTE definition; END $$;
UPDATE public.wall_tournaments SET ends_at=starts_at+interval '7 days' WHERE status='active';
ALTER TABLE public.wall_squads ADD COLUMN member_count integer NOT NULL DEFAULT 0;
UPDATE public.wall_squads s SET member_count=(SELECT count(*) FROM public.wall_squad_members m WHERE m.squad_id=s.id);
CREATE OR REPLACE FUNCTION public.wall_squad_member_count() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF TG_OP='INSERT' THEN UPDATE wall_squads SET member_count=member_count+1 WHERE id=NEW.squad_id; RETURN NEW;
ELSE UPDATE wall_squads SET member_count=greatest(0,member_count-1) WHERE id=OLD.squad_id; RETURN OLD; END IF; END $$;
REVOKE ALL ON FUNCTION public.wall_squad_member_count() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER squad_member_count AFTER INSERT OR DELETE ON public.wall_squad_members FOR EACH ROW EXECUTE FUNCTION public.wall_squad_member_count();
CREATE TABLE public.wall_squad_contributions(squad_id uuid NOT NULL REFERENCES public.wall_squads(id),week timestamptz NOT NULL,tg_id bigint NOT NULL REFERENCES public.wall_users(tg_id),points bigint NOT NULL DEFAULT 0,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(squad_id,week,tg_id));
GRANT ALL ON public.wall_squad_contributions TO service_role;
ALTER TABLE public.wall_squad_contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_only ON public.wall_squad_contributions FOR ALL TO anon,authenticated USING(false) WITH CHECK(false);
CREATE INDEX squad_contributions_tg_idx ON public.wall_squad_contributions(tg_id);
CREATE TRIGGER squad_contributions_touch BEFORE UPDATE ON public.wall_squad_contributions FOR EACH ROW EXECUTE FUNCTION public.wall_game_touch();
CREATE TABLE public.wall_squad_payouts(squad_id uuid NOT NULL REFERENCES public.wall_squads(id),week timestamptz NOT NULL,tg_id bigint NOT NULL REFERENCES public.wall_users(tg_id),amount numeric NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(squad_id,week,tg_id));
GRANT ALL ON public.wall_squad_payouts TO service_role;
ALTER TABLE public.wall_squad_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_only ON public.wall_squad_payouts FOR ALL TO anon,authenticated USING(false) WITH CHECK(false);
CREATE INDEX squad_payouts_tg_idx ON public.wall_squad_payouts(tg_id);
CREATE OR REPLACE FUNCTION public.wall_squad_points() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE sid uuid;p integer;a integer;r integer;w timestamptz; BEGIN
SELECT squad_id INTO sid FROM wall_squad_members WHERE tg_id=NEW.tg_id; IF sid IS NULL THEN RETURN NEW; END IF;
p:=NEW.points;a:=NEW.ads_count;r:=NEW.referrals_count;
IF TG_OP='UPDATE' THEN p:=p-OLD.points;a:=a-OLD.ads_count;r:=r-OLD.referrals_count; END IF;
IF p<=0 THEN RETURN NEW; END IF;
w:=date_trunc('week',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
INSERT INTO wall_squad_scores(squad_id,week,points,ads,referrals) VALUES(sid,w,p,a,r) ON CONFLICT(squad_id,week) DO UPDATE SET points=wall_squad_scores.points+EXCLUDED.points,ads=wall_squad_scores.ads+EXCLUDED.ads,referrals=wall_squad_scores.referrals+EXCLUDED.referrals;
INSERT INTO wall_squad_contributions(squad_id,week,tg_id,points) VALUES(sid,w,NEW.tg_id,p) ON CONFLICT(squad_id,week,tg_id) DO UPDATE SET points=wall_squad_contributions.points+EXCLUDED.points;
RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION public.wall_settle_squad_weeks() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE cur timestamptz:=date_trunc('week',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';w record;s record;m record;rnk integer;prize numeric;share numeric;remaining numeric;n integer;settled integer:=0; BEGIN
PERFORM pg_advisory_xact_lock(hashtext('wall_squad_settlement'));
FOR w IN SELECT DISTINCT week FROM wall_squad_scores WHERE week<cur AND NOT EXISTS(SELECT 1 FROM wall_squad_weeks sw WHERE sw.week=wall_squad_scores.week) ORDER BY week LOOP
INSERT INTO wall_squad_weeks(week,prize_pool) VALUES(w.week,10) ON CONFLICT DO NOTHING; IF NOT FOUND THEN CONTINUE; END IF;
rnk:=0;
FOR s IN SELECT squad_id FROM wall_squad_scores WHERE week=w.week AND points>0 ORDER BY points DESC,updated_at ASC,squad_id LOOP
rnk:=rnk+1;prize:=CASE rnk WHEN 1 THEN 5 WHEN 2 THEN 3 WHEN 3 THEN 2 ELSE 0 END;
UPDATE wall_squad_scores SET rank=rnk,prize_gram=prize WHERE week=w.week AND squad_id=s.squad_id;
IF prize>0 THEN
SELECT count(*) INTO n FROM wall_squad_contributions WHERE week=w.week AND squad_id=s.squad_id AND points>0;
IF n>0 THEN
share:=trunc(prize/n,8);remaining:=prize-share*n;
FOR m IN SELECT tg_id FROM wall_squad_contributions WHERE week=w.week AND squad_id=s.squad_id AND points>0 ORDER BY tg_id LOOP
INSERT INTO wall_squad_payouts(squad_id,week,tg_id,amount) VALUES(s.squad_id,w.week,m.tg_id,share+remaining);
UPDATE wall_users SET gram_balance=gram_balance+share+remaining WHERE tg_id=m.tg_id;
remaining:=0;
END LOOP; END IF; END IF; END LOOP;
settled:=settled+1; END LOOP; RETURN settled; END $$;
CREATE OR REPLACE FUNCTION public.wall_squad_board() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
WITH time AS (SELECT date_trunc('week',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AS week),
current_rows AS (SELECT s.id,s.name,s.emblem,s.member_count AS members,coalesce(p.points,0) AS points,coalesce(p.ads,0) AS ads,coalesce(p.referrals,0) AS referrals,row_number() OVER(ORDER BY coalesce(p.points,0) DESC,p.updated_at ASC NULLS LAST,s.created_at,s.id) AS rank FROM wall_squads s CROSS JOIN time t LEFT JOIN wall_squad_scores p ON p.squad_id=s.id AND p.week=t.week),
previous_week AS (SELECT max(week) AS week FROM wall_squad_weeks),
previous_rows AS (SELECT s.id,s.name,s.emblem,s.member_count AS members,p.points,p.ads,p.referrals,p.rank,p.prize_gram AS prize FROM wall_squad_scores p JOIN wall_squads s ON s.id=p.squad_id WHERE p.week=(SELECT week FROM previous_week) ORDER BY p.rank)
SELECT jsonb_build_object('week',t.week,'endsAt',t.week+interval '7 days','squads',coalesce((SELECT jsonb_agg(to_jsonb(r)||jsonb_build_object('prize',CASE WHEN r.points<=0 THEN 0 WHEN r.rank=1 THEN 5 WHEN r.rank=2 THEN 3 WHEN r.rank=3 THEN 2 ELSE 0 END) ORDER BY r.rank) FROM current_rows r),'[]'::jsonb),'previous',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.rank) FROM previous_rows r),'[]'::jsonb)) FROM time t;
$$;
REVOKE ALL ON FUNCTION public.wall_squad_board() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wall_squad_board() TO anon,authenticated,service_role;
DO $$ DECLARE e wall_energy;a numeric;before_spins integer;claim_id uuid:=gen_random_uuid();uid bigint:=-998877665544; BEGIN
BEGIN
INSERT INTO wall_users(tg_id,first_name) VALUES(uid,'transaction-only test');
e:=wall_energy_load(uid);IF e.energy<>100 THEN RAISE EXCEPTION 'energy max failed'; END IF;
PERFORM wall_energy_spend(uid);SELECT * INTO e FROM wall_energy WHERE tg_id=uid;IF e.energy<>80 THEN RAISE EXCEPTION '20 cost failed'; END IF;
UPDATE wall_energy SET energy=20,regenerated_at=now()-interval '6 minutes' WHERE tg_id=uid;
e:=wall_energy_load(uid);IF e.energy<>23 THEN RAISE EXCEPTION 'energy regen failed'; END IF;
PERFORM wall_raid_load(uid);SELECT spins INTO before_spins FROM wall_raid_state WHERE tg_id=uid;
PERFORM wall_game_ad(uid,'adsgram','spin',claim_id);PERFORM wall_game_ad(uid,'adsgram','spin',claim_id);
IF (SELECT spins FROM wall_raid_state WHERE tg_id=uid)<>before_spins+1 THEN RAISE EXCEPTION 'ad retry duplicated'; END IF;
IF (SELECT balance FROM wall_users WHERE tg_id=uid)<>15 THEN RAISE EXCEPTION 'ad coins failed'; END IF;
IF (SELECT count(*) FROM wall_ad_views WHERE tg_id=uid)<>1 THEN RAISE EXCEPTION 'ad retry view duplicated'; END IF;
PERFORM wall_game_ad(uid,'monetag','energy',gen_random_uuid());e:=wall_energy_load(uid);IF e.energy<>100 THEN RAISE EXCEPTION 'energy refill failed'; END IF;
IF EXISTS(SELECT 1 FROM wall_tournaments WHERE status='active' AND ends_at-starts_at<>interval '7 days') THEN RAISE EXCEPTION 'weekly duration failed'; END IF;
RAISE SQLSTATE 'ZX001' USING MESSAGE='rollback test fixtures';
EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL; END;
END $$;