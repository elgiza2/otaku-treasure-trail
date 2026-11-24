export const ANIME_MIN_WITHDRAW = 10_000;
export const ANIME_WAIT_DAYS = 30;
export const ANIME_USD_PER_1000 = 2;
const DAY = 86_400_000;

/** ANIME earned per daily claim = player level (at least 1). */
export const dailyAnime = (level: number) => Math.max(1, Math.floor(level));
export const canClaimAnime = (claimedAt: number | null, now: number) => claimedAt === null || now - claimedAt >= DAY;
export const daysUntilWithdraw = (joinedAt: number, now: number) => Math.max(0, Math.ceil((joinedAt + ANIME_WAIT_DAYS * DAY - now) / DAY));
export const canWithdraw = (balance: number, joinedAt: number, now: number) => balance >= ANIME_MIN_WITHDRAW && daysUntilWithdraw(joinedAt, now) === 0;
export const animeErrorMessage = (e: unknown) => {
  const m = e instanceof Error ? e.message : "";
  return ({ too_early: "استلمت النهارده، ارجع بكرة", too_new: "السحب بيفتح بعد 30 يوم من دخولك", insufficient: "رصيدك مش كفاية", min_amount: "أقل سحب 10,000 ANIME" } as Record<string, string>)[m] ?? "حصلت مشكلة، جرّب تاني";
};
