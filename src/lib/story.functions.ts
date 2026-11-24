import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { pickKey, sagaChapter, type SagaState } from "./saga";
import { authPlayer } from "./tasks.functions";
import { maskAnswer, type StoryGuess, type StoryState } from "./story-model";

const authInput = z.object({ initData: z.string().min(10).max(4096) });
const langInput = z.string().max(8).optional();

/** Today's chapter and the caller's progress. The answer itself never leaves the server. */
export const getStory = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => authInput.extend({ lang: langInput }).parse(d))
  .handler(async ({ data }): Promise<StoryState> => {
    const { user, db } = await authPlayer(data.initData);
    const today = await db.rpc("wall_story_today" as never);
    if (today.error) throw new Error(today.error.message);
    const ch = Number(today.data);
    const day = new Date().toISOString().slice(0, 10);
    const [c, st, at, solvers, pending] = await Promise.all([
      db.from("wall_story_chapters" as never).select("*").eq("id", ch).single(),
      db.from("wall_story_state" as never).select("extra_tries, hints, letters").eq("tg_id", user.id).maybeSingle(),
      db.from("wall_story_attempts" as never).select("tries, solved, solved_rank, hint_used, letters_shown").eq("tg_id", user.id).eq("day", day).maybeSingle(),
      db.from("wall_story_attempts" as never).select("tg_id", { count: "exact", head: true }).eq("day", day).eq("solved", true),
      db.from("wall_payments").select("id").eq("tg_id", user.id).in("pack", ["story_hint", "story_letter", "story_tries_3", "story_blade"]).eq("status", "pending").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (c.error) throw new Error(c.error.message);
    const chap = c.data as unknown as { title: string; story: string; riddle: string; hint: string; answer_norm: string; reward: number; image_key: string };
    const s = (st.data ?? { extra_tries: 0, hints: 0, letters: 0 }) as unknown as { extra_tries: number; hints: number; letters: number };
    const a = (at.data ?? { tries: 0, solved: false, solved_rank: null, hint_used: false, letters_shown: 0 }) as unknown as { tries: number; solved: boolean; solved_rank: number | null; hint_used: boolean; letters_shown: number };
    const revealAll = a.solved;
    // Player's language: the app's choice first, then Telegram's. Arabic comes straight from the DB.
    const { riddleText } = await import("./story-i18n.server");
    const loc = riddleText((data.lang ?? user.language_code ?? "ar").toLowerCase().split(/[-_]/)[0] ?? "ar", ch);
    const text = loc ?? { title: chap.title, story: chap.story, riddle: chap.riddle, hint: chap.hint, answers: [chap.answer_norm] };
    const answer = text.answers[0]!;
    return {
      chapter: ch, title: text.title, story: text.story, riddle: text.riddle, image: chap.image_key, reward: chap.reward,
      tries: a.tries, extra: s.extra_tries, solved: a.solved, rank: a.solved_rank,
      hint: a.hint_used || revealAll ? text.hint : null, hints: s.hints, letters: s.letters,
      mask: revealAll ? answer : a.letters_shown > 0 ? maskAnswer(answer, a.letters_shown) : null,
      lettersShown: a.letters_shown,
      solvers: solvers.count ?? 0, pendingId: pending.data?.id ?? null,
    };
  });

export const answerStory = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => authInput.extend({ guess: z.string().trim().min(1).max(60) }).parse(d))
  .handler(async ({ data }): Promise<StoryGuess> => {
    const { user, db } = await authPlayer(data.initData);
    // Answers in other languages count too: swap a correct translated guess for the chapter's Arabic answer the DB checks.
    let guess = data.guess;
    const today = await db.rpc("wall_story_today" as never);
    if (!today.error) {
      const { matchesAnyLanguage } = await import("./story-i18n.server");
      if (matchesAnyLanguage(Number(today.data), guess)) {
        const c = await db.from("wall_story_chapters" as never).select("answer_norm").eq("id", Number(today.data)).single();
        const ans = (c.data as unknown as { answer_norm: string } | null)?.answer_norm;
        if (ans) guess = ans;
      }
    }
    const r = await db.rpc("wall_story_answer" as never, { _tg: user.id, _guess: guess } as never);
    if (r.error) throw new Error(r.error.message);
    const j = r.data as unknown as { correct: boolean; coins: number; rank: number | null };
    return { correct: j.correct, coins: Number(j.coins), rank: j.rank == null ? null : Number(j.rank) };
  });

export const spendStoryItem = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => authInput.extend({ item: z.enum(["hint", "letter"]) }).parse(d))
  .handler(async ({ data }) => {
    const { user, db } = await authPlayer(data.initData);
    const r = await db.rpc("wall_story_use" as never, { _tg: user.id, _item: data.item } as never);
    if (r.error) throw new Error(r.error.message);
    return { ok: true };
  });

/** Endless campaign state: chapter, step, hearts, plays left today. */
export const getNovel = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => authInput.parse(d))
  .handler(async ({ data }) => {
    const { user, db } = await authPlayer(data.initData);
    const r = await db.rpc("wall_novel_row" as never, { _tg: user.id } as never);
    if (r.error) throw new Error(r.error.message);
    const [st, u] = await Promise.all([
      db.from("wall_story_state" as never).select("blades").eq("tg_id", user.id).maybeSingle(),
      db.from("wall_users").select("balance").eq("tg_id", user.id).maybeSingle(),
    ]);
    const sg = await db.from("wall_novel_progress" as never).select("story").eq("tg_id", user.id).maybeSingle();
    const p = r.data as unknown as { chapter: number; step: number; hearts: number; plays_used: number; ads_used: number; bonus_plays: number; wins: number; losses: number };
    return {
      chapter: p.chapter, step: p.step, hearts: p.hearts, playsUsed: p.plays_used, adsUsed: p.ads_used, bonus: p.bonus_plays,
      wins: p.wins, losses: p.losses,
      blades: Number((st.data as unknown as { blades: number } | null)?.blades ?? 0),
      balance: Number((u.data as unknown as { balance: number } | null)?.balance ?? 0),
      story: ((sg.data as unknown as { story: SagaState } | null)?.story ?? {}) as SagaState,
    };
  });

export const playNovel = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => authInput.extend({ risk: z.enum(["safe", "bold", "reckless", "blade"]) }).parse(d))
  .handler(async ({ data }) => {
    const { user, db } = await authPlayer(data.initData);
    const r = await db.rpc("wall_novel_play" as never, { _tg: user.id, _risk: data.risk } as never);
    if (r.error) throw new Error(r.error.message);
    const j = r.data as unknown as { win: boolean; coins: number; penalty: number; cleared: boolean };
    return { win: j.win, coins: Number(j.coins), penalty: Number(j.penalty), cleared: j.cleared };
  });

export const novelAdReward = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => authInput.parse(d))
  .handler(async ({ data }) => {
    const { user, db } = await authPlayer(data.initData);
    const r = await db.rpc("wall_novel_ad" as never, { _tg: user.id } as never);
    if (r.error) throw new Error(r.error.message);
    return { ok: true };
  });

/** Saves the hero setup or this chapter's story choice. Choices are final and only for the current chapter. */
export const saveSaga = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => authInput.extend({
    path: z.enum(["scout", "guard", "shadow"]).optional(),
    bond: z.enum(["mikasa", "levi", "armin"]).optional(),
    pick: z.number().int().min(0).max(2).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const { user, db } = await authPlayer(data.initData);
    const r = await db.rpc("wall_novel_row" as never, { _tg: user.id } as never);
    if (r.error) throw new Error(r.error.message);
    const row = r.data as unknown as { chapter: number; story?: SagaState };
    const cur = await db.from("wall_novel_progress" as never).select("story").eq("tg_id", user.id).maybeSingle();
    const st: SagaState = { ...((cur.data as unknown as { story: SagaState } | null)?.story ?? {}) };
    if (data.path && !st.path) st.path = data.path;
    if (data.bond && !st.bond) st.bond = data.bond;
    if (data.pick !== undefined) {
      const key = pickKey(row.chapter);
      if (data.pick >= sagaChapter(row.chapter).ch.options.length) throw new Error("bad_pick");
      st.picks = { ...(st.picks ?? {}) };
      if (st.picks[key] === undefined) st.picks[key] = data.pick;
    }
    const { error } = await db.from("wall_novel_progress" as never).update({ story: st } as never).eq("tg_id", user.id);
    if (error) throw new Error(error.message);
    return st;
  });
