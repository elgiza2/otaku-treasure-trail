export const MINE_PASS_TON = 0.05;
export const MINE_PASS_NANO = 50_000_000n;
export type MinePass = { number: number; activatedAt: string };
export function hasMinePass(pass: MinePass | null | undefined): boolean {
  return !!pass && Number.isSafeInteger(pass.number) && pass.number > 0;
}
/** Collectible serial shown on the pass card, e.g. 7 -> "#0007"; larger numbers keep all digits. */
export function formatPassNumber(n: number): string {
  return "#" + String(Math.max(0, Math.trunc(n))).padStart(4, "0");
}
