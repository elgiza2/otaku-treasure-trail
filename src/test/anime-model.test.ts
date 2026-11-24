import { describe, expect, it } from "vitest";
import { canClaimAnime, canWithdraw, dailyAnime, daysUntilWithdraw } from "@/lib/anime-model";
const D = 86_400_000, NOW = Date.UTC(2026, 10, 17);
describe("ANIME earnings", () => {
  it("level 70 earns 70 a day", () => expect(dailyAnime(70)).toBe(70));
  it("claims once per 24h", () => { expect(canClaimAnime(NOW - D + 1000, NOW)).toBe(false); expect(canClaimAnime(NOW - D, NOW)).toBe(true); });
  it("withdraw needs 10,000 and 30 days", () => {
    expect(canWithdraw(9_999, NOW - 31 * D, NOW)).toBe(false);
    expect(canWithdraw(10_000, NOW - 29 * D, NOW)).toBe(false);
    expect(canWithdraw(10_000, NOW - 30 * D, NOW)).toBe(true);
    expect(daysUntilWithdraw(NOW - 20 * D, NOW)).toBe(10);
  });
});
