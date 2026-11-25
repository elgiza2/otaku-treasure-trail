CREATE TABLE public.wall_growth_state(tg_id bigint PRIMARY KEY REFERENCES public.wall_users(tg_id) ON DELETE CASCADE, chest_at timestamptz, wallet_rewarded boolean NOT NULL DEFAULT false, referral_milestones integer NOT NULL DEFAULT 0, protection_until timestamptz, boost_until timestamptz, boss_strikes integer NOT NULL DEFAULT 0, notifications boolean NOT NULL DEFAULT false, notified_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.wall_growth_state TO service_role;
ALTER TABLE public.wall_growth_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY growth_private ON public.wall_growth_state FOR ALL TO anon,authenticated USING(false) WITH CHECK(false);
CREATE TABLE public.wall_growth_claims(request_id uuid PRIMARY KEY, tg_id bigint NOT NULL REFERENCES public.wall_users(tg_id), kind text NOT NULL, result jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.wall_growth_claims TO service_role;
ALTER TABLE public.wall_growth_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY growth_claims_private ON public.wall_growth_claims FOR ALL TO anon,authenticated USING(false) WITH CHECK(false);
CREATE INDEX growth_claims_user ON public.wall_growth_claims(tg_id);
CREATE TABLE public.wall_friend_duels(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), challenger bigint NOT NULL REFERENCES public.wall_users(tg_id), opponent bigint REFERENCES public.wall_users(tg_id), winner bigint REFERENCES public.wall_users(tg_id), stake numeric NOT NULL DEFAULT 20 CHECK(stake=20), status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','settled','cancelled')), expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours', avenged boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.wall_friend_duels TO service_role;
ALTER TABLE public.wall_friend_duels ENABLE ROW LEVEL SECURITY;
CREATE POLICY duels_private ON public.wall_friend_duels FOR ALL TO anon,authenticated USING(false) WITH CHECK(false);
CREATE INDEX friend_duels_challenger ON public.wall_friend_duels(challenger);
CREATE INDEX friend_duels_opponent ON public.wall_friend_duels(opponent);
CREATE INDEX friend_duels_winner ON public.wall_friend_duels(winner);
CREATE TABLE public.wall_squad_bosses(squad_id uuid NOT NULL REFERENCES public.wall_squads(id), week timestamptz NOT NULL, hp integer NOT NULL DEFAULT 10000 CHECK(hp>=0), defeated_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(squad_id,week));
GRANT ALL ON public.wall_squad_bosses TO service_role;
ALTER TABLE public.wall_squad_bosses ENABLE ROW LEVEL SECURITY;
CREATE POLICY boss_private ON public.wall_squad_bosses FOR ALL TO anon,authenticated USING(false) WITH CHECK(false);
CREATE TABLE public.wall_boss_hits(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), squad_id uuid NOT NULL, week timestamptz NOT NULL, tg_id bigint NOT NULL REFERENCES public.wall_users(tg_id), damage integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(squad_id,week) REFERENCES public.wall_squad_bosses(squad_id,week));
GRANT ALL ON public.wall_boss_hits TO service_role;
ALTER TABLE public.wall_boss_hits ENABLE ROW LEVEL SECURITY;
CREATE POLICY hits_private ON public.wall_boss_hits FOR ALL TO anon,authenticated USING(false) WITH CHECK(false);
CREATE INDEX boss_hits_user ON public.wall_boss_hits(tg_id);
CREATE INDEX boss_hits_boss ON public.wall_boss_hits(squad_id,week);
CREATE OR REPLACE FUNCTION public.wall_growth_touch() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
CREATE TRIGGER growth_touch BEFORE UPDATE ON public.wall_growth_state FOR EACH ROW EXECUTE FUNCTION public.wall_growth_touch();
CREATE TRIGGER claims_touch BEFORE UPDATE ON public.wall_growth_claims FOR EACH ROW EXECUTE FUNCTION public.wall_growth_touch();
CREATE TRIGGER duels_touch BEFORE UPDATE ON public.wall_friend_duels FOR EACH ROW EXECUTE FUNCTION public.wall_growth_touch();
CREATE TRIGGER bosses_touch BEFORE UPDATE ON public.wall_squad_bosses FOR EACH ROW EXECUTE FUNCTION public.wall_growth_touch();
CREATE TRIGGER hits_touch BEFORE UPDATE ON public.wall_boss_hits FOR EACH ROW EXECUTE FUNCTION public.wall_growth_touch();
CREATE OR REPLACE FUNCTION public.wall_referral_milestone(_tg bigint) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE n integer; paid integer; reward integer; BEGIN
PERFORM 1 FROM wall_users WHERE tg_id=_tg FOR UPDATE;
INSERT INTO wall_growth_state(tg_id) VALUES(_tg) ON CONFLICT DO NOTHING;
SELECT count(*)/100 INTO n FROM wall_users u JOIN wall_mine_passes p ON p.tg_id=u.tg_id WHERE u.referrer_id=_tg AND u.tg_id<>_tg;
SELECT referral_milestones INTO paid FROM wall_growth_state WHERE tg_id=_tg FOR UPDATE;
reward:=greatest(0,n-paid);
IF reward>0 THEN UPDATE wall_users SET gram_balance=gram_balance+reward WHERE tg_id=_tg; UPDATE wall_growth_state SET referral_milestones=n WHERE tg_id=_tg; END IF; RETURN reward; END $$;
CREATE OR REPLACE FUNCTION public.wall_pass_milestone_trigger() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE r bigint; BEGIN SELECT referrer_id INTO r FROM wall_users WHERE tg_id=NEW.tg_id; IF r IS NOT NULL AND r<>NEW.tg_id THEN PERFORM wall_referral_milestone(r); END IF; RETURN NEW; END $$;
CREATE TRIGGER pass_milestone AFTER INSERT ON public.wall_mine_passes FOR EACH ROW EXECUTE FUNCTION public.wall_pass_milestone_trigger();
CREATE OR REPLACE FUNCTION public.wall_daily_checkin(_tg bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE u wall_users; d integer; r numeric; e integer; BEGIN
SELECT * INTO u FROM wall_users WHERE tg_id=_tg FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'no_user'; END IF;
IF (u.last_checkin_at AT TIME ZONE 'UTC')::date=(now() AT TIME ZONE 'UTC')::date THEN RAISE EXCEPTION 'too_early'; END IF;
IF (u.last_checkin_at AT TIME ZONE 'UTC')::date=(now() AT TIME ZONE 'UTC')::date-1 THEN d:=u.checkin_streak%7+1; ELSE d:=1; END IF;
r:=4+d;e:=5*d; PERFORM wall_energy_load(_tg); UPDATE wall_energy SET energy=least(100,energy+e) WHERE tg_id=_tg;
UPDATE wall_users SET checkin_streak=d,last_checkin_at=now(),balance=balance+r WHERE tg_id=_tg;
INSERT INTO wall_checkins(tg_id,streak_day,reward) VALUES(_tg,d,r);
IF d=7 THEN PERFORM wall_raid_load(_tg); UPDATE wall_raid_state SET spins=spins+1 WHERE tg_id=_tg; END IF;
RETURN jsonb_build_object('streak_day',d,'reward',r,'energy',e,'spins',CASE WHEN d=7 THEN 1 ELSE 0 END); END $$;
CREATE OR REPLACE FUNCTION public.wall_growth_payment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE expected bigint; BEGIN
IF NEW.status<>'paid' OR OLD.status='paid' OR NEW.pack NOT IN ('micro_energy','micro_spins5','micro_shield','micro_boost','boss_strike') THEN RETURN NEW; END IF;
expected:=CASE WHEN NEW.pack='boss_strike' THEN 50000000 ELSE 100000000 END;
IF NEW.amount_nano<>expected OR NEW.coins<>0 OR coalesce(NEW.tx_hash,'')='' THEN RAISE EXCEPTION 'bad_micro_payment'; END IF;
INSERT INTO wall_growth_state(tg_id) VALUES(NEW.tg_id) ON CONFLICT DO NOTHING;
IF NEW.pack='micro_energy' THEN PERFORM wall_energy_load(NEW.tg_id); UPDATE wall_energy SET energy=100,regenerated_at=now() WHERE tg_id=NEW.tg_id;
ELSIF NEW.pack='micro_spins5' THEN PERFORM wall_raid_load(NEW.tg_id); UPDATE wall_raid_state SET spins=spins+5 WHERE tg_id=NEW.tg_id;
ELSIF NEW.pack='micro_shield' THEN UPDATE wall_growth_state SET protection_until=greatest(now(),coalesce(protection_until,now()))+interval '24 hours' WHERE tg_id=NEW.tg_id;
ELSIF NEW.pack='micro_boost' THEN UPDATE wall_growth_state SET boost_until=greatest(now(),coalesce(boost_until,now()))+interval '24 hours' WHERE tg_id=NEW.tg_id;
ELSE UPDATE wall_growth_state SET boss_strikes=boss_strikes+1 WHERE tg_id=NEW.tg_id; END IF; RETURN NEW; END $$;
CREATE TRIGGER growth_payment AFTER UPDATE OF status ON public.wall_payments FOR EACH ROW EXECUTE FUNCTION public.wall_growth_payment();
DO $$ DECLARE d text; BEGIN
SELECT pg_get_functiondef(oid) INTO d FROM pg_proc WHERE proname='wall_mining_claim' AND pronamespace='public'::regnamespace;
d:=replace(d,'UPDATE wall_users SET balance = balance + _amt, mined_at = now()', 'IF EXISTS(SELECT 1 FROM wall_growth_state WHERE tg_id=_tg AND boost_until>now()) THEN _amt:=_amt*2; END IF; UPDATE wall_users SET balance = balance + _amt, mined_at = now()'); EXECUTE d;
SELECT pg_get_functiondef(oid) INTO d FROM pg_proc WHERE proname='wall_raid_spin' AND pronamespace='public'::regnamespace;
d:=replace(d,'IF _vsh > 0 THEN','IF _vsh > 0 OR EXISTS(SELECT 1 FROM wall_growth_state WHERE tg_id=_victim AND protection_until>now()) THEN');
d:=replace(d,'SET shields = shields - 1','SET shields = greatest(0,shields - 1)'); EXECUTE d; END $$;
CREATE OR REPLACE FUNCTION public.wall_growth_action(_tg bigint,_action text,_request uuid,_provider text DEFAULT NULL,_target uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE g wall_growth_state; d wall_friend_duels; r jsonb; amount numeric:=0; sid uuid; wk timestamptz:=date_trunc('week',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'; hp integer; damage integer; n integer; winner_id bigint; m record; BEGIN
IF _action='duel_accept' THEN
SELECT * INTO d FROM wall_friend_duels WHERE id=_target FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'no_duel'; END IF;
PERFORM 1 FROM wall_users WHERE tg_id IN (_tg,d.challenger) ORDER BY tg_id FOR UPDATE;
ELSE PERFORM 1 FROM wall_users WHERE tg_id=_tg FOR UPDATE; END IF;
IF NOT EXISTS(SELECT 1 FROM wall_users WHERE tg_id=_tg) THEN RAISE EXCEPTION 'no_user'; END IF;
SELECT result INTO r FROM wall_growth_claims WHERE request_id=_request AND tg_id=_tg AND kind=_action; IF FOUND THEN RETURN r; END IF;
INSERT INTO wall_growth_claims(request_id,tg_id,kind) VALUES(_request,_tg,_action);
INSERT INTO wall_growth_state(tg_id) VALUES(_tg) ON CONFLICT DO NOTHING;
SELECT * INTO g FROM wall_growth_state WHERE tg_id=_tg FOR UPDATE;
IF _action='daily' THEN r:=wall_daily_checkin(_tg);
ELSIF _action IN ('chest','chest_ad') THEN
IF g.chest_at IS NOT NULL AND g.chest_at+interval '8 hours'>now() THEN RAISE EXCEPTION 'chest_wait'; END IF;
amount:=15+floor(random()*36); IF _action='chest_ad' THEN PERFORM wall_ad_reward_v2(_tg,_provider);amount:=amount*2; END IF;
UPDATE wall_users SET balance=balance+amount WHERE tg_id=_tg; UPDATE wall_growth_state SET chest_at=now() WHERE tg_id=_tg;r:=jsonb_build_object('amount',amount);
ELSIF _action='referrals' THEN amount:=wall_referral_milestone(_tg);r:=jsonb_build_object('gram',amount);
ELSIF _action IN ('notify_on','notify_off') THEN UPDATE wall_growth_state SET notifications=(_action='notify_on') WHERE tg_id=_tg;r:=jsonb_build_object('ok',true);
ELSIF _action='duel_create' THEN
UPDATE wall_users SET balance=balance-20 WHERE tg_id=_tg AND balance>=20; IF NOT FOUND THEN RAISE EXCEPTION 'insufficient_coins'; END IF;
INSERT INTO wall_friend_duels(challenger) VALUES(_tg) RETURNING * INTO d;r:=jsonb_build_object('id',d.id);
ELSIF _action='duel_cancel' THEN
SELECT * INTO d FROM wall_friend_duels WHERE id=_target AND challenger=_tg AND status='pending' FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'no_duel'; END IF;
UPDATE wall_friend_duels SET status='cancelled' WHERE id=d.id;UPDATE wall_users SET balance=balance+20 WHERE tg_id=_tg;r:=jsonb_build_object('amount',20);
ELSIF _action='duel_accept' THEN
IF d.challenger=_tg OR d.status<>'pending' OR d.expires_at<=now() THEN RAISE EXCEPTION 'duel_unavailable'; END IF;
UPDATE wall_users SET balance=balance-20 WHERE tg_id=_tg AND balance>=20; IF NOT FOUND THEN RAISE EXCEPTION 'insufficient_coins'; END IF;
winner_id:=CASE WHEN random()<0.5 THEN _tg ELSE d.challenger END;
UPDATE wall_users SET balance=balance+40 WHERE tg_id=winner_id;
UPDATE wall_friend_duels SET opponent=_tg,winner=winner_id,status='settled' WHERE id=d.id;
r:=jsonb_build_object('won',winner_id=_tg,'amount',CASE WHEN winner_id=_tg THEN 40 ELSE 0 END);
ELSIF _action='duel_revenge' THEN
SELECT * INTO d FROM wall_friend_duels WHERE id=_target AND status='settled' AND winner<>_tg AND (challenger=_tg OR opponent=_tg) AND NOT avenged FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'no_revenge'; END IF;
PERFORM wall_ad_reward_v2(_tg,_provider);UPDATE wall_friend_duels SET avenged=true WHERE id=d.id;UPDATE wall_users SET balance=balance+10 WHERE tg_id=_tg;r:=jsonb_build_object('amount',10);
ELSIF _action IN ('boss','boss_ad','boss_paid') THEN
SELECT squad_id INTO sid FROM wall_squad_members WHERE tg_id=_tg;IF sid IS NULL THEN RAISE EXCEPTION 'no_squad'; END IF;
INSERT INTO wall_squad_bosses(squad_id,week) VALUES(sid,wk) ON CONFLICT DO NOTHING;
SELECT b.hp INTO hp FROM wall_squad_bosses b WHERE squad_id=sid AND week=wk FOR UPDATE;IF hp=0 THEN RAISE EXCEPTION 'boss_defeated'; END IF;
IF _action='boss_paid' THEN UPDATE wall_growth_state SET boss_strikes=boss_strikes-1 WHERE tg_id=_tg AND boss_strikes>0;IF NOT FOUND THEN RAISE EXCEPTION 'no_strikes';END IF;damage:=1000;
ELSIF _action='boss_ad' THEN PERFORM wall_ad_reward_v2(_tg,_provider);damage:=500;
ELSE PERFORM wall_energy_spend(_tg);damage:=100; END IF;
damage:=least(damage,hp);INSERT INTO wall_boss_hits(squad_id,week,tg_id,damage) VALUES(sid,wk,_tg,damage);
UPDATE wall_squad_bosses SET hp=hp-damage,defeated_at=CASE WHEN hp-damage=0 THEN now() END WHERE squad_id=sid AND week=wk;
IF hp-damage=0 THEN
INSERT INTO wall_squad_scores(squad_id,week,points) VALUES(sid,wk,1000) ON CONFLICT(squad_id,week) DO UPDATE SET points=wall_squad_scores.points+1000,updated_at=now();
SELECT count(DISTINCT tg_id) INTO n FROM wall_boss_hits WHERE squad_id=sid AND week=wk;
FOR m IN SELECT DISTINCT tg_id FROM wall_boss_hits WHERE squad_id=sid AND week=wk LOOP
INSERT INTO wall_squad_contributions(squad_id,week,tg_id,points) VALUES(sid,wk,m.tg_id,1000.0/n) ON CONFLICT(squad_id,week,tg_id) DO UPDATE SET points=wall_squad_contributions.points+excluded.points;
END LOOP; END IF;
r:=jsonb_build_object('damage',damage,'hp',hp-damage);
ELSE RAISE EXCEPTION 'bad_action'; END IF;
UPDATE wall_growth_claims SET result=r WHERE request_id=_request;RETURN r; END $$;
CREATE OR REPLACE FUNCTION public.wall_growth_load(_tg bigint,_invite uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE g wall_growth_state; u wall_users; sid uuid; wk timestamptz:=date_trunc('week',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'; refs integer; hp integer:=10000; d record; BEGIN
PERFORM 1 FROM wall_users WHERE tg_id=_tg FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'no_user'; END IF;
PERFORM wall_referral_milestone(_tg);
FOR d IN SELECT id FROM wall_friend_duels WHERE challenger=_tg AND status='pending' AND expires_at<=now() FOR UPDATE LOOP UPDATE wall_friend_duels SET status='cancelled' WHERE id=d.id;UPDATE wall_users SET balance=balance+20 WHERE tg_id=_tg;END LOOP;
SELECT * INTO g FROM wall_growth_state WHERE tg_id=_tg;SELECT * INTO u FROM wall_users WHERE tg_id=_tg;
SELECT count(*) INTO refs FROM wall_users x JOIN wall_mine_passes p ON p.tg_id=x.tg_id WHERE x.referrer_id=_tg AND x.tg_id<>_tg;
SELECT squad_id INTO sid FROM wall_squad_members WHERE tg_id=_tg;
IF sid IS NOT NULL THEN SELECT b.hp INTO hp FROM wall_squad_bosses b WHERE squad_id=sid AND week=wk;hp:=coalesce(hp,10000); END IF;
RETURN jsonb_build_object('tgId',_tg,'name',u.first_name,'balance',u.balance,'gram',u.gram_balance,'verified',EXISTS(SELECT 1 FROM wall_mine_passes WHERE tg_id=_tg),'streak',u.checkin_streak,'lastCheckinAt',u.last_checkin_at,'chestAt',g.chest_at,'referrals',refs,'milestones',g.referral_milestones,'boostUntil',g.boost_until,'protectionUntil',g.protection_until,'bossStrikes',g.boss_strikes,'notifications',g.notifications,'squadId',sid,'bossHp',hp,'bossEndsAt',wk+interval '7 days','duels',coalesce((SELECT jsonb_agg(jsonb_build_object('id',x.id,'mine',x.challenger=_tg,'status',x.status,'won',x.winner=_tg,'avenged',x.avenged,'expiresAt',x.expires_at,'name',(SELECT first_name FROM wall_users WHERE tg_id=CASE WHEN x.challenger=_tg THEN x.opponent ELSE x.challenger END))) FROM (SELECT * FROM wall_friend_duels WHERE challenger=_tg OR opponent=_tg ORDER BY created_at DESC LIMIT 20) x),'[]'::jsonb),'invite',CASE WHEN _invite IS NULL THEN NULL ELSE (SELECT jsonb_build_object('id',x.id,'name',a.first_name,'status',x.status,'expiresAt',x.expires_at,'mine',x.challenger=_tg) FROM wall_friend_duels x JOIN wall_users a ON a.tg_id=x.challenger WHERE x.id=_invite) END);END $$;
CREATE OR REPLACE FUNCTION public.wall_growth_save_wallet(_tg bigint,_address text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE awarded boolean:=false; BEGIN
PERFORM 1 FROM wall_users WHERE tg_id=_tg FOR UPDATE;
INSERT INTO wall_growth_state(tg_id) VALUES(_tg) ON CONFLICT DO NOTHING;
UPDATE wall_users SET wallet_address=_address WHERE tg_id=_tg;
UPDATE wall_growth_state SET wallet_rewarded=true WHERE tg_id=_tg AND NOT wallet_rewarded RETURNING true INTO awarded;
IF awarded THEN PERFORM wall_raid_load(_tg);UPDATE wall_raid_state SET spins=spins+1 WHERE tg_id=_tg; END IF; RETURN jsonb_build_object('ok',true,'bonusSpin',coalesce(awarded,false)); END $$;
REVOKE ALL ON FUNCTION public.wall_growth_action(bigint,text,uuid,text,uuid),public.wall_growth_load(bigint,uuid),public.wall_growth_save_wallet(bigint,text),public.wall_referral_milestone(bigint),public.wall_pass_milestone_trigger(),public.wall_growth_payment(),public.wall_growth_touch() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wall_growth_action(bigint,text,uuid,text,uuid),public.wall_growth_load(bigint,uuid),public.wall_growth_save_wallet(bigint,text),public.wall_referral_milestone(bigint) TO service_role;