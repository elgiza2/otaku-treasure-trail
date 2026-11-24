DROP FUNCTION IF EXISTS public.wall_defense_load(bigint);
DROP FUNCTION IF EXISTS public.wall_defense_play(bigint, integer);
DROP TABLE IF EXISTS public.wall_defense_state;

CREATE TABLE public.wall_story_chapters (
  id smallint PRIMARY KEY,
  title text NOT NULL,
  story text NOT NULL,
  riddle text NOT NULL,
  hint text NOT NULL,
  answer text NOT NULL,
  reward integer NOT NULL DEFAULT 5000,
  image_key text NOT NULL
);
GRANT ALL ON public.wall_story_chapters TO service_role;
ALTER TABLE public.wall_story_chapters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "server only" ON public.wall_story_chapters FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

INSERT INTO public.wall_story_chapters (id, title, story, riddle, hint, answer, reward, image_key) VALUES
(1, 'فجر على السور', 'الشمس طلعت والضباب لسه مغطي الأرض. من فوق السور، الكشاف شاف ضلال عمالقة ماشية ناحية المدينة. القائد ساب له رسالة قبل ما يختفي، وقال: اللي يفهمها هيعرف إحنا بنحمي إيه.', 'بحمي الناس من غير ما أتحرك، والعمالقة بتضربني وأنا واقف مكاني. أنا مين؟', 'بص تحت رجلين الكشاف في الصورة.', 'سور', 5000, 'dawn'),
(2, 'الغابة المحروقة', 'الفرقة دخلت الغابة بالليل والنار لسه مولعة. إيد عملاقة طلعت من ورا الشجر، والكابتن صرخ بكلمة السر عشان الفرقة تتجمع. محدش سمعها كاملة، بس سابوا 3 كلمات محفورة على الشجر.', 'خد أول حرف من كل كلمة بالترتيب: نار، جبل، مطر. الكلمة اللي هتطلع هي كلمة السر.', 'هي حاجة بتلمع في السما فوق القمر.', 'نجم', 5000, 'forest'),
(3, 'نفق تحت القلعة', 'تحت القلعة فيه نفق قديم مقفول بسلاسل. على الباب الحديد كلمة مكتوبة بالمقلوب، والنور الدهبي جاي من آخر النفق. الحراس بيقولوا اللي يقرأ الكلمة صح هيوصل للي مستخبي.', 'الكلمة على الباب مكتوبة بالعكس: زنك. إيه الكلمة الحقيقية؟', 'اقرأها من الشمال لليمين.', 'كنز', 5000, 'tunnel'),
(4, 'باب الخزينة', 'الكشاف وصل لباب الخزينة الكبير، وحواليه دهب في كل حتة. الباب مفيهوش قفل عادي، مكتوب عليه سؤال واحد بس، واللي يجاوب يفتحه.', 'عندي أسنان بس مبعضش، وبفتح الأبواب المقفولة. أنا إيه؟', 'الكشاف ماسكه في إيده في الصورة.', 'مفتاح', 5000, 'vault');

ALTER TABLE public.wall_story_chapters RENAME COLUMN answer TO answer_norm;

CREATE TABLE public.wall_story_state (
  tg_id bigint PRIMARY KEY REFERENCES public.wall_users(tg_id) ON DELETE CASCADE,
  extra_tries integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.wall_story_state TO service_role;
ALTER TABLE public.wall_story_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "server only" ON public.wall_story_state FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE TABLE public.wall_story_attempts (
  tg_id bigint NOT NULL REFERENCES public.wall_users(tg_id) ON DELETE CASCADE,
  day date NOT NULL,
  chapter smallint NOT NULL,
  tries integer NOT NULL DEFAULT 0,
  solved boolean NOT NULL DEFAULT false,
  solved_rank integer,
  solved_at timestamptz,
  PRIMARY KEY (tg_id, day)
);
CREATE INDEX wall_story_attempts_day_idx ON public.wall_story_attempts (day) WHERE solved;
GRANT ALL ON public.wall_story_attempts TO service_role;
ALTER TABLE public.wall_story_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "server only" ON public.wall_story_attempts FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Same normalisation as normalizeAnswer in story-model.ts
CREATE OR REPLACE FUNCTION public.wall_story_norm(_t text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT regexp_replace(
           translate(regexp_replace(lower(coalesce(_t, '')), '[[:space:][:punct:]ـًٌٍَُِّْ]', '', 'g'), 'أإآةى', 'اااهي'),
           '^ال', '')
$$;

-- Today's chapter rotates daily through all chapters (mirrors chapterForDay)
CREATE OR REPLACE FUNCTION public.wall_story_today() RETURNS smallint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (((current_date - date '2026-01-01') % (SELECT count(*) FROM wall_story_chapters)) + 1)::smallint
$$;

-- One guess. 3 free tries a day, then paid extra tries. Correct answer pays once; first 10 solvers +2000.
CREATE OR REPLACE FUNCTION public.wall_story_answer(_tg bigint, _guess text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ch smallint; _c wall_story_chapters; _a wall_story_attempts; _extra integer; _ok boolean; _rank integer; _coins integer := 0;
BEGIN
  IF length(coalesce(_guess, '')) = 0 OR length(_guess) > 60 THEN RAISE EXCEPTION 'bad_guess'; END IF;
  _ch := wall_story_today();
  SELECT * INTO _c FROM wall_story_chapters WHERE id = _ch;
  INSERT INTO wall_story_state(tg_id) VALUES (_tg) ON CONFLICT DO NOTHING;
  INSERT INTO wall_story_attempts(tg_id, day, chapter) VALUES (_tg, current_date, _ch) ON CONFLICT DO NOTHING;
  SELECT * INTO _a FROM wall_story_attempts WHERE tg_id = _tg AND day = current_date FOR UPDATE;
  IF _a.solved THEN RAISE EXCEPTION 'already_solved'; END IF;
  SELECT extra_tries INTO _extra FROM wall_story_state WHERE tg_id = _tg FOR UPDATE;
  IF _a.tries >= 3 THEN
    IF _extra <= 0 THEN RAISE EXCEPTION 'no_tries'; END IF;
    UPDATE wall_story_state SET extra_tries = extra_tries - 1 WHERE tg_id = _tg;
    _extra := _extra - 1;
  END IF;
  _ok := wall_story_norm(_guess) = wall_story_norm(_c.answer_norm);
  IF _ok THEN
    PERFORM pg_advisory_xact_lock(hashtext('wall_story_rank'));
    SELECT count(*) + 1 INTO _rank FROM wall_story_attempts WHERE day = current_date AND solved;
    _coins := _c.reward + CASE WHEN _rank <= 10 THEN 2000 ELSE 0 END;
    UPDATE wall_story_attempts SET tries = tries + 1, solved = true, solved_rank = _rank, solved_at = now() WHERE tg_id = _tg AND day = current_date;
    UPDATE wall_users SET balance = balance + _coins WHERE tg_id = _tg;
  ELSE
    UPDATE wall_story_attempts SET tries = tries + 1 WHERE tg_id = _tg AND day = current_date;
  END IF;
  RETURN jsonb_build_object('correct', _ok, 'coins', _coins, 'rank', _rank, 'tries', _a.tries + 1, 'extra', _extra);
END $$;

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
 ELSIF _p.pack = 'story_tries_3' THEN
  IF _p.coins <> 0 OR _p.amount_nano <> 500000000 THEN RAISE EXCEPTION 'bad_story_payment'; END IF;
  INSERT INTO wall_story_state(tg_id) VALUES (_p.tg_id) ON CONFLICT DO NOTHING;
  UPDATE wall_story_state SET extra_tries = extra_tries + 3 WHERE tg_id = _p.tg_id;
 ELSE
  UPDATE wall_users SET balance = balance + _p.coins WHERE tg_id = _p.tg_id;
 END IF;
 UPDATE wall_payments SET status = 'paid', tx_hash = _tx, paid_at = now() WHERE id = _id;
 RETURN _p.coins;
END $$;

REVOKE ALL ON FUNCTION public.wall_story_norm(text), public.wall_story_today(), public.wall_story_answer(bigint,text), public.wall_confirm_payment(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wall_story_norm(text), public.wall_story_today(), public.wall_story_answer(bigint,text), public.wall_confirm_payment(uuid,text) TO service_role;