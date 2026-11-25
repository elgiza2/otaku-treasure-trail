CREATE TABLE public.wall_energy(tg_id bigint PRIMARY KEY REFERENCES public.wall_users(tg_id), energy integer NOT NULL DEFAULT 100, regenerated_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.wall_energy TO service_role;
ALTER TABLE public.wall_energy ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.wall_game_ad_claims(request_id uuid PRIMARY KEY, tg_id bigint NOT NULL REFERENCES public.wall_users(tg_id), benefit text NOT NULL, result jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.wall_game_ad_claims TO service_role;
ALTER TABLE public.wall_game_ad_claims ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.wall_squads(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, emblem text NOT NULL DEFAULT '⚔️', captain bigint NOT NULL REFERENCES public.wall_users(tg_id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.wall_squads TO anon, authenticated; GRANT ALL ON public.wall_squads TO service_role;
ALTER TABLE public.wall_squads ENABLE ROW LEVEL SECURITY;
CREATE POLICY squads_public_read ON public.wall_squads FOR SELECT TO anon, authenticated USING (true);
CREATE TABLE public.wall_squad_members(tg_id bigint PRIMARY KEY REFERENCES public.wall_users(tg_id), squad_id uuid NOT NULL REFERENCES public.wall_squads(id), created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.wall_squad_members TO service_role;
ALTER TABLE public.wall_squad_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX wall_squad_members_squad ON public.wall_squad_members(squad_id);
CREATE TABLE public.wall_squad_scores(squad_id uuid NOT NULL REFERENCES public.wall_squads(id), week timestamptz NOT NULL, points bigint NOT NULL DEFAULT 0, ads bigint NOT NULL DEFAULT 0, referrals bigint NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(squad_id,week));
GRANT SELECT ON public.wall_squad_scores TO anon, authenticated; GRANT ALL ON public.wall_squad_scores TO service_role;
ALTER TABLE public.wall_squad_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY squad_scores_public_read ON public.wall_squad_scores FOR SELECT TO anon, authenticated USING(true);
CREATE OR REPLACE FUNCTION public.wall_game_touch() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
CREATE TRIGGER energy_touch BEFORE UPDATE ON public.wall_energy FOR EACH ROW EXECUTE FUNCTION public.wall_game_touch();
CREATE TRIGGER squads_touch BEFORE UPDATE ON public.wall_squads FOR EACH ROW EXECUTE FUNCTION public.wall_game_touch();
CREATE TRIGGER squad_scores_touch BEFORE UPDATE ON public.wall_squad_scores FOR EACH ROW EXECUTE FUNCTION public.wall_game_touch();
CREATE OR REPLACE FUNCTION public.wall_energy_load(_tg bigint) RETURNS public.wall_energy LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE e wall_energy; n integer; BEGIN
PERFORM 1 FROM wall_users WHERE tg_id=_tg FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'no_user'; END IF;
INSERT INTO wall_energy(tg_id) VALUES(_tg) ON CONFLICT DO NOTHING;
SELECT * INTO e FROM wall_energy WHERE tg_id=_tg FOR UPDATE;
n:=greatest(0,floor(extract(epoch from now()-e.regenerated_at)/120)::integer);
IF e.energy>=100 THEN UPDATE wall_energy SET regenerated_at=now() WHERE tg_id=_tg RETURNING * INTO e;
ELSIF n>0 THEN UPDATE wall_energy SET energy=least(100,energy+n), regenerated_at=CASE WHEN energy+n>=100 THEN now() ELSE regenerated_at+make_interval(secs=>n*120) END WHERE tg_id=_tg RETURNING * INTO e; END IF;
RETURN e; END $$;
CREATE OR REPLACE FUNCTION public.wall_energy_spend(_tg bigint) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE e wall_energy; BEGIN e:=wall_energy_load(_tg); IF e.energy<20 THEN RAISE EXCEPTION 'no_energy'; END IF; UPDATE wall_energy SET energy=energy-20 WHERE tg_id=_tg; END $$;
CREATE OR REPLACE FUNCTION public.wall_game_spin(_tg bigint,_revenge bigint DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN PERFORM wall_energy_spend(_tg); RETURN wall_raid_spin(_tg,_revenge); END $$;
CREATE OR REPLACE FUNCTION public.wall_game_collect(_tg bigint) RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE amt numeric; BEGIN PERFORM wall_energy_spend(_tg); amt:=wall_mining_claim(_tg); IF amt<=0 THEN RAISE EXCEPTION 'no_loot'; END IF; RETURN amt; END $$;
CREATE OR REPLACE FUNCTION public.wall_game_ad(_tg bigint,_provider text,_benefit text,_request uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE r jsonb; amt numeric:=0; BEGIN
IF _benefit NOT IN ('spin','energy','double') THEN RAISE EXCEPTION 'bad_benefit'; END IF;
PERFORM 1 FROM wall_users WHERE tg_id=_tg FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'no_user'; END IF;
SELECT result INTO r FROM wall_game_ad_claims WHERE request_id=_request AND tg_id=_tg; IF FOUND THEN RETURN r; END IF;
INSERT INTO wall_game_ad_claims(request_id,tg_id,benefit) VALUES(_request,_tg,_benefit);
IF _benefit='double' THEN amt:=wall_game_collect(_tg); UPDATE wall_users SET balance=balance+amt WHERE tg_id=_tg;
ELSIF _benefit='spin' THEN PERFORM wall_raid_load(_tg); UPDATE wall_raid_state SET spins=spins+1 WHERE tg_id=_tg;
ELSE PERFORM wall_energy_load(_tg); UPDATE wall_energy SET energy=100,regenerated_at=now() WHERE tg_id=_tg; END IF;
PERFORM wall_ad_reward_v2(_tg,_provider);
r:=jsonb_build_object('amount',amt*2,'adReward',15,'benefit',_benefit);
UPDATE wall_game_ad_claims SET result=r WHERE request_id=_request; RETURN r; END $$;
CREATE OR REPLACE FUNCTION public.wall_squad_points() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE sid uuid; p integer; a integer; r integer; BEGIN
SELECT squad_id INTO sid FROM wall_squad_members WHERE tg_id=NEW.tg_id; IF sid IS NULL THEN RETURN NEW; END IF;
p:=NEW.points; a:=NEW.ads_count; r:=NEW.referrals_count;
IF TG_OP='UPDATE' THEN p:=p-OLD.points; a:=a-OLD.ads_count; r:=r-OLD.referrals_count; END IF;
IF p<=0 THEN RETURN NEW; END IF;
INSERT INTO wall_squad_scores(squad_id,week,points,ads,referrals) VALUES(sid,date_trunc('week',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC',p,a,r)
ON CONFLICT(squad_id,week) DO UPDATE SET points=wall_squad_scores.points+EXCLUDED.points,ads=wall_squad_scores.ads+EXCLUDED.ads,referrals=wall_squad_scores.referrals+EXCLUDED.referrals; RETURN NEW; END $$;
CREATE TRIGGER squad_points_after_tournament AFTER INSERT OR UPDATE ON public.wall_tournament_entries FOR EACH ROW EXECUTE FUNCTION public.wall_squad_points();
CREATE OR REPLACE FUNCTION public.wall_squad_manage(_tg bigint,_action text,_squad uuid DEFAULT NULL,_name text DEFAULT NULL,_emblem text DEFAULT '⚔️') RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE sid uuid; cap bigint; replacement bigint; BEGIN
PERFORM 1 FROM wall_users WHERE tg_id=_tg FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'no_user'; END IF;
SELECT squad_id INTO sid FROM wall_squad_members WHERE tg_id=_tg;
IF _action='leave' THEN
IF sid IS NULL THEN RETURN NULL; END IF;
SELECT captain INTO cap FROM wall_squads WHERE id=sid FOR UPDATE;
DELETE FROM wall_squad_members WHERE tg_id=_tg;
IF cap=_tg THEN SELECT tg_id INTO replacement FROM wall_squad_members WHERE squad_id=sid ORDER BY created_at,tg_id LIMIT 1; IF replacement IS NOT NULL THEN UPDATE wall_squads SET captain=replacement WHERE id=sid; END IF; END IF;
RETURN NULL;
END IF;
IF sid IS NOT NULL THEN RAISE EXCEPTION 'already_in_squad'; END IF;
IF _action='create' THEN
IF char_length(trim(coalesce(_name,''))) NOT BETWEEN 3 AND 32 OR _emblem NOT IN ('⚔️','🛡️','🔥','🐉') THEN RAISE EXCEPTION 'bad_squad'; END IF;
INSERT INTO wall_squads(name,emblem,captain) VALUES(trim(_name),_emblem,_tg) RETURNING id INTO sid;
ELSIF _action='join' THEN
SELECT id INTO sid FROM wall_squads WHERE id=_squad FOR UPDATE; IF sid IS NULL THEN RAISE EXCEPTION 'no_squad'; END IF;
ELSE RAISE EXCEPTION 'bad_action'; END IF;
INSERT INTO wall_squad_members(tg_id,squad_id) VALUES(_tg,sid); RETURN sid; END $$;
REVOKE ALL ON FUNCTION public.wall_energy_load(bigint), public.wall_energy_spend(bigint), public.wall_game_spin(bigint,bigint), public.wall_game_collect(bigint), public.wall_game_ad(bigint,text,text,uuid), public.wall_squad_manage(bigint,text,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wall_energy_load(bigint), public.wall_energy_spend(bigint), public.wall_game_spin(bigint,bigint), public.wall_game_collect(bigint), public.wall_game_ad(bigint,text,text,uuid), public.wall_squad_manage(bigint,text,uuid,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.wall_squad_points() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wall_squad_points() TO service_role;