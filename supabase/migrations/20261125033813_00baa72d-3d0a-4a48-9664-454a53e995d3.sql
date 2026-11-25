CREATE OR REPLACE FUNCTION public.wall_partner_withdraw(_tg bigint,_channel uuid,_address text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE c wall_partner_channels;wid uuid;first_at timestamptz;last_at timestamptz;amount numeric;BEGIN
PERFORM 1 FROM wall_users WHERE tg_id=_tg FOR UPDATE;
SELECT * INTO c FROM wall_partner_channels WHERE id=_channel AND owner_tg=_tg FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'forbidden';END IF;
PERFORM 1 FROM wall_partner_channels WHERE owner_tg=_tg FOR UPDATE;
SELECT min(started_at),max(last_withdrawal_at),sum(balance_gram) INTO first_at,last_at,amount FROM wall_partner_channels WHERE owner_tg=_tg;
IF now()<coalesce(last_at,first_at)+interval '30 days' THEN RAISE EXCEPTION 'withdrawal_wait';END IF;
IF coalesce(amount,0)<=0 THEN RAISE EXCEPTION 'no_balance';END IF;
IF _address !~ '^(EQ|UQ)[A-Za-z0-9_-]{46}$' THEN RAISE EXCEPTION 'bad_address';END IF;
IF EXISTS(SELECT 1 FROM wall_partner_withdrawals WHERE owner_tg=_tg AND status='pending') THEN RAISE EXCEPTION 'withdrawal_pending';END IF;
INSERT INTO wall_partner_withdrawals(channel_id,owner_tg,amount_gram,address) VALUES(c.id,_tg,amount,_address) RETURNING id INTO wid;
UPDATE wall_partner_channels SET balance_gram=0,last_withdrawal_at=now() WHERE owner_tg=_tg;RETURN wid;END $$;
DO $$ DECLARE owner_id bigint:=-998877001;join_id bigint:=-998877002;cid uuid;wid uuid;v numeric;blocked boolean;BEGIN
BEGIN
INSERT INTO wall_users(tg_id,first_name) VALUES(owner_id,'transaction-only partner test');
INSERT INTO wall_partner_channels(chat_id,owner_tg,title,status) VALUES(-998877003,owner_id,'transaction-only channel','active') RETURNING id INTO cid;
PERFORM wall_partner_upsert_user(join_id,NULL,'transaction-only referred user',NULL,NULL,cid);
PERFORM wall_partner_upsert_user(join_id,NULL,'transaction-only referred user',NULL,NULL,cid);
SELECT balance_gram INTO v FROM wall_partner_channels WHERE id=cid;IF v<>0.01 THEN RAISE EXCEPTION 'new user reward/idempotency test failed';END IF;
IF (SELECT count(*) FROM wall_partner_acquisitions WHERE tg_id=join_id)<>1 THEN RAISE EXCEPTION 'unique user test failed';END IF;
blocked:=false;
BEGIN PERFORM wall_partner_withdraw(owner_id,cid,'UQ'||repeat('A',46));EXCEPTION WHEN raise_exception THEN IF SQLERRM='withdrawal_wait' THEN blocked:=true;ELSE RAISE;END IF;END;
IF NOT blocked THEN RAISE EXCEPTION 'first 30 day wait failed';END IF;
UPDATE wall_partner_channels SET started_at=now()-interval '30 days' WHERE id=cid;
wid:=wall_partner_withdraw(owner_id,cid,'UQ'||repeat('A',46));
IF (SELECT amount_gram FROM wall_partner_withdrawals WHERE id=wid)<>0.01 THEN RAISE EXCEPTION 'reserved amount test failed';END IF;
IF (SELECT balance_gram FROM wall_partner_channels WHERE id=cid)<>0 THEN RAISE EXCEPTION 'reserve balance failed';END IF;
PERFORM wall_partner_review_withdrawal(wid,false,NULL);
IF (SELECT balance_gram FROM wall_partner_channels WHERE id=cid)<>0.01 THEN RAISE EXCEPTION 'refund test failed';END IF;
blocked:=false;
BEGIN PERFORM wall_partner_withdraw(owner_id,cid,'UQ'||repeat('A',46));EXCEPTION WHEN raise_exception THEN IF SQLERRM='withdrawal_wait' THEN blocked:=true;ELSE RAISE;END IF;END;
IF NOT blocked THEN RAISE EXCEPTION 'repeat 30 day wait failed';END IF;
RAISE SQLSTATE 'ZX001' USING MESSAGE='rollback all test fixtures';
EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;END;END $$;