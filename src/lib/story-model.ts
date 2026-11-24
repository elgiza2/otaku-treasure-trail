// Illustrated story + riddle rules. Mirrored by wall_story_* / wall_confirm_payment in the DB — change both together.
export const FREE_TRIES = 3;
export const FIRST_SOLVERS = 10;
export const FIRST_SOLVER_BONUS = 2000;
export const COMMUNITY_URL = "https://t.me/micahub";
/** Chapters rotate daily starting from this date (UTC). */
export const STORY_EPOCH = Date.UTC(2026, 0, 1);

export type StoryItemId = "story_hint" | "story_letter" | "story_tries_3" | "story_blade";
export const STORY_ITEMS: { id: StoryItemId; ton: number; label: string; desc: string }[] = [
  { id: "story_hint", ton: 0.2, label: "تلميح", desc: "يكشف تلميح لغز النهارده" },
  { id: "story_letter", ton: 0.3, label: "كشف حرف", desc: "يظهر حرف من الإجابة" },
  { id: "story_blade", ton: 0.4, label: "سيف الرعد", desc: "يفتح الاختيار السري في القصة" },
  { id: "story_tries_3", ton: 0.5, label: "3 محاولات", desc: "محاولات زيادة بعد ما تخلص" },
];
export function findStoryItem(id: string) {
  return STORY_ITEMS.find((i) => i.id === id);
}

/** Same rules as wall_story_norm: drop spaces/punctuation/diacritics, unify alef/ta-marbuta/ya, drop leading "ال". */
export function normalizeAnswer(t: string): string {
  return t
    .toLowerCase()
    .replace(/[\s\p{P}\u0640\u064B-\u0652]/gu, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/^ال/, "");
}

/** 1-based chapter for a UTC day, rotating through `count` chapters. */
export function chapterForDay(now: Date, count: number): number {
  const day = Math.floor((now.getTime() - STORY_EPOCH) / 86_400_000);
  return (((day % count) + count) % count) + 1;
}

/** Coins for solving: reward, plus a bonus for the first solvers of the day. */
export function solveCoins(reward: number, rank: number): number {
  return reward + (rank <= FIRST_SOLVERS ? FIRST_SOLVER_BONUS : 0);
}

/** Letters shown as "ك _ _" — the first `shown` letters, the rest hidden. */
export function maskAnswer(answer: string, shown: number): string {
  return [...answer].map((c, i) => (i < shown ? c : "_")).join(" ");
}

export type StoryState = {
  chapter: number; title: string; story: string; riddle: string; image: string; reward: number;
  tries: number; extra: number; solved: boolean; rank: number | null;
  hint: string | null; hints: number; letters: number; mask: string | null; lettersShown: number;
  solvers: number; pendingId: string | null;
};
export type StoryGuess = { correct: boolean; coins: number; rank: number | null };
