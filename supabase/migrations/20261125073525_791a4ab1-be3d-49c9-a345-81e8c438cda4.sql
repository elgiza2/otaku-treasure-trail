CREATE TABLE public.wall_partner_posts(channel_id uuid NOT NULL REFERENCES public.wall_partner_channels(id), slot text NOT NULL, status text NOT NULL DEFAULT 'sending' CHECK(status IN ('sending','sent','failed')), message_id bigint, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(channel_id,slot));
GRANT ALL ON public.wall_partner_posts TO service_role;
ALTER TABLE public.wall_partner_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY partner_posts_private ON public.wall_partner_posts FOR ALL TO anon,authenticated USING(false) WITH CHECK(false);
CREATE TRIGGER partner_posts_touch BEFORE UPDATE ON public.wall_partner_posts FOR EACH ROW EXECUTE FUNCTION public.wall_growth_touch();
CREATE OR REPLACE FUNCTION public.wall_partner_register(_tg bigint,_chat bigint,_title text,_username text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE c wall_partner_channels; BEGIN
PERFORM 1 FROM wall_users WHERE tg_id=_tg FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'no_user';END IF;
PERFORM pg_advisory_xact_lock(hashtextextended(_chat::text,1));
SELECT * INTO c FROM wall_partner_channels WHERE chat_id=_chat FOR UPDATE;
IF FOUND THEN IF c.owner_tg<>_tg THEN RAISE EXCEPTION 'channel_owned';END IF;UPDATE wall_partner_channels SET title=left(_title,150),username=_username,status='active',updated_at=now() WHERE id=c.id;RETURN c.id;END IF;
INSERT INTO wall_partner_channels(chat_id,owner_tg,title,username,status) VALUES(_chat,_tg,left(_title,150),_username,'active') RETURNING id INTO c.id;RETURN c.id;END $$;
CREATE OR REPLACE FUNCTION public.wall_partner_claim_post(_channel uuid,_slot text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
INSERT INTO wall_partner_posts(channel_id,slot) VALUES(_channel,_slot) ON CONFLICT(channel_id,slot) DO UPDATE SET status='sending',updated_at=now() WHERE wall_partner_posts.status='failed';RETURN FOUND;END $$;
CREATE OR REPLACE FUNCTION public.wall_smart_notifications() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE tid uuid; cutoff bigint; BEGIN
SELECT id INTO tid FROM wall_tournaments WHERE status='active' ORDER BY starts_at DESC LIMIT 1;
SELECT points INTO cutoff FROM wall_tournament_entries WHERE tournament_id=tid AND points>0 ORDER BY points DESC,updated_at LIMIT 1 OFFSET 19;
RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('tgId',u.tg_id,'energyFull',coalesce(e.energy+floor(extract(epoch from now()-e.regenerated_at)/120),0)>=100,'adsNeeded',CASE WHEN cutoff IS NOT NULL AND t.points<cutoff AND cutoff-t.points<=30 THEN ceil((cutoff-t.points+1)/10.0) ELSE NULL END)) FROM wall_growth_state g JOIN wall_users u ON u.tg_id=g.tg_id LEFT JOIN wall_energy e ON e.tg_id=u.tg_id LEFT JOIN wall_tournament_entries t ON t.tg_id=u.tg_id AND t.tournament_id=tid WHERE g.notifications AND NOT u.bot_blocked AND (g.notified_at IS NULL OR g.notified_at<now()-interval '24 hours') AND (coalesce(e.energy+floor(extract(epoch from now()-e.regenerated_at)/120),0)>=100 OR (t.points>0 AND t.points<cutoff AND cutoff-t.points<=30)) LIMIT 150),'[]'::jsonb);END $$;
REVOKE ALL ON FUNCTION public.wall_partner_register(bigint,bigint,text,text),public.wall_partner_claim_post(uuid,text),public.wall_smart_notifications() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wall_partner_register(bigint,bigint,text,text),public.wall_partner_claim_post(uuid,text),public.wall_smart_notifications() TO service_role;