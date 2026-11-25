CREATE TABLE public.wall_partner_channels(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),chat_id bigint NOT NULL UNIQUE,owner_tg bigint NOT NULL REFERENCES public.wall_users(tg_id),title text NOT NULL,username text,status text NOT NULL DEFAULT 'pending',started_at timestamptz NOT NULL DEFAULT now(),joined_users bigint NOT NULL DEFAULT 0,earned_gram numeric NOT NULL DEFAULT 0,balance_gram numeric NOT NULL DEFAULT 0,last_withdrawal_at timestamptz,last_post_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.wall_partner_channels TO service_role;
ALTER TABLE public.wall_partner_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_only ON public.wall_partner_channels FOR ALL TO anon,authenticated USING(false) WITH CHECK(false);
CREATE INDEX partner_owner ON public.wall_partner_channels(owner_tg);
CREATE TRIGGER partner_touch BEFORE UPDATE ON public.wall_partner_channels FOR EACH ROW EXECUTE FUNCTION public.wall_game_touch();
CREATE TABLE public.wall_partner_acquisitions(tg_id bigint PRIMARY KEY REFERENCES public.wall_users(tg_id),channel_id uuid NOT NULL REFERENCES public.wall_partner_channels(id),reward_gram numeric NOT NULL DEFAULT 0.01,created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.wall_partner_acquisitions TO service_role;
ALTER TABLE public.wall_partner_acquisitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_only ON public.wall_partner_acquisitions FOR ALL TO anon,authenticated USING(false) WITH CHECK(false);
CREATE INDEX partner_acquisition_channel ON public.wall_partner_acquisitions(channel_id);
CREATE TABLE public.wall_partner_withdrawals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),channel_id uuid NOT NULL REFERENCES public.wall_partner_channels(id),owner_tg bigint NOT NULL REFERENCES public.wall_users(tg_id),amount_gram numeric NOT NULL,address text NOT NULL,status text NOT NULL DEFAULT 'pending',tx_hash text,reviewed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.wall_partner_withdrawals TO service_role;
ALTER TABLE public.wall_partner_withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_only ON public.wall_partner_withdrawals FOR ALL TO anon,authenticated USING(false) WITH CHECK(false);
CREATE INDEX partner_withdrawal_channel ON public.wall_partner_withdrawals(channel_id);
CREATE INDEX partner_withdrawal_owner ON public.wall_partner_withdrawals(owner_tg);
CREATE TRIGGER partner_withdrawal_touch BEFORE UPDATE ON public.wall_partner_withdrawals FOR EACH ROW EXECUTE FUNCTION public.wall_game_touch();
CREATE TABLE public.wall_daily_reports(day date PRIMARY KEY,adsgram_views bigint NOT NULL DEFAULT 0,monetag_views bigint NOT NULL DEFAULT 0,new_channels bigint NOT NULL DEFAULT 0,new_users bigint NOT NULL DEFAULT 0,partner_users bigint NOT NULL DEFAULT 0,partner_earned_gram numeric NOT NULL DEFAULT 0,paid_ton numeric NOT NULL DEFAULT 0,adsgram_revenue_usd numeric,monetag_revenue_usd numeric,costs_usd numeric,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.wall_daily_reports TO service_role;
ALTER TABLE public.wall_daily_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_only ON public.wall_daily_reports FOR ALL TO anon,authenticated USING(false) WITH CHECK(false);
CREATE TRIGGER daily_report_touch BEFORE UPDATE ON public.wall_daily_reports FOR EACH ROW EXECUTE FUNCTION public.wall_game_touch();
CREATE OR REPLACE FUNCTION public.wall_partner_upsert_user(_tg bigint,_username text,_first text,_photo text,_ref bigint,_channel uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE existed boolean;c wall_partner_channels; BEGIN
PERFORM pg_advisory_xact_lock(_tg);
SELECT EXISTS(SELECT 1 FROM wall_users WHERE tg_id=_tg) INTO existed;
IF _channel IS NOT NULL THEN SELECT * INTO c FROM wall_partner_channels WHERE id=_channel AND status='active' FOR UPDATE; END IF;
PERFORM wall_upsert_user(_tg,_username,_first,_photo,CASE WHEN c.id IS NOT NULL THEN c.owner_tg ELSE _ref END);
IF NOT existed AND c.id IS NOT NULL AND c.owner_tg<>_tg THEN
INSERT INTO wall_partner_acquisitions(tg_id,channel_id,reward_gram) VALUES(_tg,c.id,0.01) ON CONFLICT DO NOTHING;
IF FOUND THEN UPDATE wall_partner_channels SET joined_users=joined_users+1,earned_gram=earned_gram+0.01,balance_gram=balance_gram+0.01 WHERE id=c.id; END IF; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.wall_partner_withdraw(_tg bigint,_channel uuid,_address text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE c wall_partner_channels;wid uuid; BEGIN
SELECT * INTO c FROM wall_partner_channels WHERE id=_channel AND owner_tg=_tg FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;
IF now()<coalesce(c.last_withdrawal_at,c.started_at)+interval '30 days' THEN RAISE EXCEPTION 'withdrawal_wait'; END IF;
IF c.balance_gram<=0 THEN RAISE EXCEPTION 'no_balance'; END IF;
IF char_length(_address) NOT BETWEEN 40 AND 120 THEN RAISE EXCEPTION 'bad_address'; END IF;
IF EXISTS(SELECT 1 FROM wall_partner_withdrawals WHERE channel_id=c.id AND status='pending') THEN RAISE EXCEPTION 'withdrawal_pending'; END IF;
INSERT INTO wall_partner_withdrawals(channel_id,owner_tg,amount_gram,address) VALUES(c.id,_tg,c.balance_gram,_address) RETURNING id INTO wid;
UPDATE wall_partner_channels SET balance_gram=0,last_withdrawal_at=now() WHERE id=c.id;RETURN wid;END $$;
CREATE OR REPLACE FUNCTION public.wall_partner_review_withdrawal(_id uuid,_paid boolean,_tx text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE w wall_partner_withdrawals;BEGIN
SELECT * INTO w FROM wall_partner_withdrawals WHERE id=_id FOR UPDATE;IF NOT FOUND OR w.status<>'pending' THEN RAISE EXCEPTION 'not_pending';END IF;
IF _paid AND char_length(coalesce(_tx,''))<8 THEN RAISE EXCEPTION 'tx_required';END IF;
UPDATE wall_partner_withdrawals SET status=CASE WHEN _paid THEN 'paid' ELSE 'rejected' END,tx_hash=_tx,reviewed_at=now() WHERE id=_id;
IF NOT _paid THEN UPDATE wall_partner_channels SET balance_gram=balance_gram+w.amount_gram WHERE id=w.channel_id; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.wall_generate_daily_report(_day date DEFAULT (now() AT TIME ZONE 'UTC')::date-1) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE starts timestamptz:=_day::timestamp AT TIME ZONE 'UTC';ends timestamptz:=(_day+1)::timestamp AT TIME ZONE 'UTC';BEGIN
INSERT INTO wall_daily_reports(day,adsgram_views,monetag_views,new_channels,new_users,partner_users,partner_earned_gram,paid_ton)
SELECT _day,(SELECT count(*) FROM wall_ad_views WHERE created_at>=starts AND created_at<ends AND provider='adsgram'),(SELECT count(*) FROM wall_ad_views WHERE created_at>=starts AND created_at<ends AND provider='monetag'),(SELECT count(*) FROM wall_partner_channels WHERE created_at>=starts AND created_at<ends),(SELECT count(*) FROM wall_users WHERE created_at>=starts AND created_at<ends),(SELECT count(*) FROM wall_partner_acquisitions WHERE created_at>=starts AND created_at<ends),(SELECT coalesce(sum(reward_gram),0) FROM wall_partner_acquisitions WHERE created_at>=starts AND created_at<ends),(SELECT coalesce(sum(amount_nano)/1e9,0) FROM wall_payments WHERE status='paid' AND paid_at>=starts AND paid_at<ends)
ON CONFLICT(day) DO UPDATE SET adsgram_views=EXCLUDED.adsgram_views,monetag_views=EXCLUDED.monetag_views,new_channels=EXCLUDED.new_channels,new_users=EXCLUDED.new_users,partner_users=EXCLUDED.partner_users,partner_earned_gram=EXCLUDED.partner_earned_gram,paid_ton=EXCLUDED.paid_ton;END $$;
CREATE OR REPLACE FUNCTION public.wall_partner_overview() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT jsonb_build_object('adsgramViews',(SELECT count(*) FROM wall_ad_views WHERE created_at>=now()-interval '24 hours' AND provider='adsgram'),'monetagViews',(SELECT count(*) FROM wall_ad_views WHERE created_at>=now()-interval '24 hours' AND provider='monetag'),'newChannels',(SELECT count(*) FROM wall_partner_channels WHERE created_at>=now()-interval '24 hours'),'newUsers',(SELECT count(*) FROM wall_users WHERE created_at>=now()-interval '24 hours'),'partnerEarnedGram',(SELECT coalesce(sum(reward_gram),0) FROM wall_partner_acquisitions WHERE created_at>=now()-interval '24 hours'));$$;
REVOKE ALL ON FUNCTION public.wall_partner_upsert_user(bigint,text,text,text,bigint,uuid),public.wall_partner_withdraw(bigint,uuid,text),public.wall_partner_review_withdrawal(uuid,boolean,text),public.wall_generate_daily_report(date),public.wall_partner_overview() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wall_partner_upsert_user(bigint,text,text,text,bigint,uuid),public.wall_partner_withdraw(bigint,uuid,text),public.wall_partner_review_withdrawal(uuid,boolean,text),public.wall_generate_daily_report(date),public.wall_partner_overview() TO service_role;
SELECT cron.schedule('wall-daily-owner-report','5 0 * * *','select public.wall_generate_daily_report(); select public.wall_settle_squad_weeks(); select public.wall_ensure_active_tournament();');
SELECT public.wall_generate_daily_report();