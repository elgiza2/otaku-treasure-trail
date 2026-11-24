CREATE TABLE public.wall_raid_state (
  tg_id bigint PRIMARY KEY REFERENCES public.wall_users(tg_id) ON DELETE CASCADE,
  spins integer NOT NULL DEFAULT 5,
  spins_at timestamptz NOT NULL DEFAULT now(),
  shields integer NOT NULL DEFAULT 0,
  keys integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.wall_raid_state TO service_role;
ALTER TABLE public.wall_raid_state ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.wall_raids (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  attacker bigint NOT NULL,
  victim bigint NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  blocked boolean NOT NULL DEFAULT false,
  revenge boolean NOT NULL DEFAULT false,
  avenged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wall_raids_victim_idx ON public.wall_raids (victim, created_at DESC);
GRANT ALL ON public.wall_raids TO service_role;
ALTER TABLE public.wall_raids ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.wall_vault (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  pot numeric NOT NULL DEFAULT 500000,
  last_winner bigint,
  last_win numeric,
  last_win_at timestamptz
);
INSERT INTO public.wall_vault (id) VALUES (1) ON CONFLICT DO NOTHING;
GRANT ALL ON public.wall_vault TO service_role;
ALTER TABLE public.wall_vault ENABLE ROW LEVEL SECURITY;

-- Free spins: max 5, +1 per hour (mirrors regenSpins in raid-model.ts)
CREATE OR REPLACE FUNCTION public.wall_raid_load(_tg bigint) RETURNS wall_raid_state
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _s wall_raid_state; _h integer;
BEGIN
  INSERT INTO wall_raid_state(tg_id) VALUES (_tg) ON CONFLICT DO NOTHING;
  SELECT * INTO _s FROM wall_raid_state WHERE tg_id = _tg FOR UPDATE;
  IF _s.spins >= 5 THEN
    UPDATE wall_raid_state SET spins_at = now() WHERE tg_id = _tg RETURNING * INTO _s;
  ELSE
    _h := floor(extract(epoch FROM now() - _s.spins_at) / 3600)::int;
    IF _h > 0 THEN
      UPDATE wall_raid_state SET spins = LEAST(5, spins + _h),
        spins_at = CASE WHEN spins + _h >= 5 THEN now() ELSE spins_at + make_interval(hours => _h) END
      WHERE tg_id = _tg RETURNING * INTO _s;
    END IF;
  END IF;
  RETURN _s;
END $$;

-- One spin. Segments (weights): coins 35, big coins 10, shield 15, raid 22, key 18.
CREATE OR REPLACE FUNCTION public.wall_raid_spin(_tg bigint, _revenge bigint DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _s wall_raid_state; _r double precision; _seg text; _amt numeric := 0;
  _victim bigint; _vbal numeric; _vsh integer; _blocked boolean := false; _pot numeric; _won numeric := 0; _raid wall_raids;
BEGIN
  _s := wall_raid_load(_tg);
  IF _revenge IS NOT NULL THEN
    SELECT * INTO _raid FROM wall_raids WHERE id = _revenge AND victim = _tg AND NOT avenged AND NOT blocked FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'no_revenge'; END IF;
  END IF;
  IF _s.spins <= 0 THEN RAISE EXCEPTION 'no_spins'; END IF;
  UPDATE wall_raid_state SET spins = spins - 1, spins_at = CASE WHEN spins >= 5 THEN now() ELSE spins_at END WHERE tg_id = _tg;
  UPDATE wall_vault SET pot = pot + 250 WHERE id = 1;

  IF _revenge IS NOT NULL THEN _seg := 'raid'; _victim := _raid.attacker;
  ELSE
    _r := random() * 100;
    _seg := CASE WHEN _r < 35 THEN 'coins' WHEN _r < 45 THEN 'jackpot_coins' WHEN _r < 60 THEN 'shield' WHEN _r < 82 THEN 'raid' ELSE 'key' END;
  END IF;

  IF _seg = 'coins' THEN _amt := 1000;
  ELSIF _seg = 'jackpot_coins' THEN _amt := 5000;
  ELSIF _seg = 'shield' THEN
    IF _s.shields >= 3 THEN _amt := 1500; ELSE UPDATE wall_raid_state SET shields = shields + 1 WHERE tg_id = _tg; END IF;
  ELSIF _seg = 'key' THEN
    IF _s.keys + 1 >= 3 THEN
      SELECT pot INTO _pot FROM wall_vault WHERE id = 1 FOR UPDATE;
      _won := round(_pot * 0.1);
      UPDATE wall_vault SET pot = pot - _won, last_winner = _tg, last_win = _won, last_win_at = now() WHERE id = 1;
      UPDATE wall_raid_state SET keys = 0 WHERE tg_id = _tg;
      _amt := _won; _seg := 'vault';
    ELSE UPDATE wall_raid_state SET keys = keys + 1 WHERE tg_id = _tg; END IF;
  ELSIF _seg = 'raid' THEN
    IF _victim IS NULL THEN
      SELECT tg_id INTO _victim FROM wall_users WHERE tg_id <> _tg AND balance > 0 ORDER BY random() LIMIT 1;
    END IF;
    IF _victim IS NULL THEN _seg := 'coins'; _amt := 1000;
    ELSE
      INSERT INTO wall_raid_state(tg_id) VALUES (_victim) ON CONFLICT DO NOTHING;
      SELECT shields INTO _vsh FROM wall_raid_state WHERE tg_id = _victim FOR UPDATE;
      SELECT balance INTO _vbal FROM wall_users WHERE tg_id = _victim FOR UPDATE;
      IF _vsh > 0 THEN
        _blocked := true; _amt := 300;
        UPDATE wall_raid_state SET shields = shields - 1 WHERE tg_id = _victim;
      ELSE
        _amt := LEAST(round(_vbal * 0.1), 50000);
        UPDATE wall_users SET balance = balance - _amt WHERE tg_id = _victim;
      END IF;
      INSERT INTO wall_raids(attacker, victim, amount, blocked, revenge) VALUES (_tg, _victim, CASE WHEN _blocked THEN 0 ELSE _amt END, _blocked, _revenge IS NOT NULL);
      IF _revenge IS NOT NULL THEN UPDATE wall_raids SET avenged = true WHERE id = _revenge; END IF;
    END IF;
  END IF;

  IF _amt > 0 THEN UPDATE wall_users SET balance = balance + _amt WHERE tg_id = _tg; END IF;
  RETURN jsonb_build_object('segment', _seg, 'amount', _amt, 'blocked', _blocked, 'victim', _victim);
END $$;

-- TON spin packs: amounts mirror SPIN_PACKS in raid-model.ts
CREATE OR REPLACE FUNCTION public.wall_confirm_payment(_id uuid, _tx text) RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p wall_payments; _d smallint; _sp integer; _need bigint;
BEGIN
 SELECT * INTO _p FROM wall_payments WHERE id = _id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'no_payment'; END IF;
 IF _p.status IN ('paid','refund_due') THEN RETURN 0; END IF;
 PERFORM 1 FROM wall_users WHERE tg_id = _p.tg_id FOR UPDATE;
 IF _p.pack = 'mine_pass' THEN
  IF _p.amount_nano <> 50000000 OR _p.coins <> 0 THEN RAISE EXCEPTION 'bad_pass_payment'; END IF;
  INSERT INTO wall_mine_passes(tg_id, payment_id) VALUES (_p.tg_id, _p.id) ON CONFLICT (tg_id) DO NOTHING;
  IF FOUND THEN UPDATE wall_users SET mined_at = now() WHERE tg_id = _p.tg_id; END IF;
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
 ELSE
  UPDATE wall_users SET balance = balance + _p.coins WHERE tg_id = _p.tg_id;
 END IF;
 UPDATE wall_payments SET status = 'paid', tx_hash = _tx, paid_at = now() WHERE id = _id;
 RETURN _p.coins;
END $$;

REVOKE ALL ON FUNCTION public.wall_raid_load(bigint), public.wall_raid_spin(bigint,bigint), public.wall_confirm_payment(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wall_raid_load(bigint), public.wall_raid_spin(bigint,bigint), public.wall_confirm_payment(uuid,text) TO service_role;