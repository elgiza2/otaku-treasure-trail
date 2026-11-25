// Pure task/check-in rules shared by the page and tests. The database functions
// (wall_daily_checkin, wall_claim_task) enforce the same rules on the server.

export type TaskCategory = "onchain" | "game" | "social" | "partners";
export type TaskKind = "telegram" | "link" | "x" | "share" | "referral" | "wallet";

export type TaskDTO = {
  id: string;
  category: TaskCategory;
  kind: TaskKind;
  title: string;
  url: string | null;
  reward: number;
  cooldownHours: number | null;
  required: number;
  emoji: string;
  sort: number;
};

export type ProgressDTO = { taskId: string; startedAt: string | null; lastClaimedAt: string | null };

export type PlayerDTO = {
  tgId: number;
  firstName: string;
  balance: number;
  wallet: string | null;
  streak: number;
  lastCheckinAt: string | null;
  referrals: number;
  weekEarned: number;
};

export const CHECKIN_DAYS = 7;
export const USER_TASK_PACK = "user_task_1000";
export const USER_TASK_TON = 1;
export const USER_TASK_MAX_USERS = 1000;
const HOUR = 3_600_000;

export function validateUserTaskInput(title: string, url: string): { title: string; url: string } | { error: string } {
  const cleanTitle = title.trim();
  if (cleanTitle.length < 3 || cleanTitle.length > 80) return { error: "اكتب اسم المهمة من 3 إلى 80 حرف" };
  const cleanUrl = url.trim();
  try {
    const parsed = new URL(cleanUrl);
    if (parsed.protocol !== "https:") return { error: "الرابط لازم يبدأ بـ https://" };
  } catch {
    return { error: "اكتب رابط صحيح يبدأ بـ https://" };
  }
  return { title: cleanTitle, url: cleanUrl };
}

/** Day 1 pays 5, each following day one more, day 7 pays 11. */
export function checkinReward(day: number): number {
  return 4 + day;
}

export type CheckinState = {
  claimable: boolean;
  /** Day number the next claim will pay for (1–7). */
  nextDay: number;
  /** Days already collected in the current 7-day cycle. */
  doneDays: number;
  /** When the next claim opens (only when not claimable). */
  nextAt: number | null;
};

export function checkinState(streak: number, lastCheckinAt: string | null, now: number): CheckinState {
  if (!lastCheckinAt) return { claimable: true, nextDay: 1, doneDays: 0, nextAt: null };
  const last = new Date(lastCheckinAt).getTime();
  const day = 24 * HOUR;
  const lastDay = Math.floor(last / day);
  const today = Math.floor(now / day);
  if (today > lastDay + 1) return { claimable: true, nextDay: 1, doneDays: 0, nextAt: null };
  const nextDay = (streak % CHECKIN_DAYS) + 1;
  if (today <= lastDay) return { claimable: false, nextDay, doneDays: streak, nextAt: (lastDay + 1) * day };
  return { claimable: true, nextDay, doneDays: nextDay === 1 ? 0 : streak, nextAt: null };
}

export type TaskState =
  | { type: "go" }
  | { type: "verify" }
  | { type: "progress"; have: number; need: number }
  | { type: "ready" }
  | { type: "cooldown"; until: number }
  | { type: "done" };

export function taskState(task: TaskDTO, progress: ProgressDTO | undefined, player: PlayerDTO | null, now: number): TaskState {
  const last = progress?.lastClaimedAt ? new Date(progress.lastClaimedAt).getTime() : null;
  if (last !== null) {
    if (task.cooldownHours === null) return { type: "done" };
    const until = last + task.cooldownHours * HOUR;
    if (now < until) return { type: "cooldown", until };
  }
  if (task.kind === "referral") {
    const have = player?.referrals ?? 0;
    return have >= task.required ? { type: "ready" } : { type: "progress", have, need: task.required };
  }
  if (task.kind === "wallet") return player?.wallet ? { type: "ready" } : { type: "go" };
  return progress?.startedAt ? { type: "verify" } : { type: "go" };
}

export function isAvailable(state: TaskState): boolean {
  return state.type === "go" || state.type === "verify" || state.type === "ready" || state.type === "progress";
}

export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}

export const CLAIM_ERRORS: Record<string, string> = {
  too_early: "استلمت مكافأة اليوم، ارجع بكرة",
  too_fast: "خلّص المهمة الأول وارجع اضغط تحقق",
  not_started: "اضغط «اذهب» الأول",
  not_joined: "لسه ما انضمّيتش للقناة",
  already_done: "خلّصت المهمة دي قبل كده",
  cooldown: "المهمة دي هتفتح تاني قريب",
  not_enough_referrals: "لسه محتاج أصدقاء أكتر",
  wallet_missing: "اربط محفظتك الأول",
  unauthorized: "افتح اللعبة من تيليجرام",
  task_full: "اكتمل عدد المستخدمين لهذه المهمة",
};

export function claimErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const key = Object.keys(CLAIM_ERRORS).find((k) => msg.includes(k));
  return (key ? CLAIM_ERRORS[key] : undefined) ?? "حصلت مشكلة، حاول تاني";
}
