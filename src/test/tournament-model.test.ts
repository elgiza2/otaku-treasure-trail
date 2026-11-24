import { describe, expect, it } from "vitest";
import {
  formatCountdown,
  prizeForRank,
  TOURNAMENT_AD_POINTS,
  TOURNAMENT_DURATION_DAYS,
  TOURNAMENT_PRIZE_POOL,
  TOURNAMENT_REFERRAL_POINTS,
  TOURNAMENT_VERIFY_TON,
  TOURNAMENT_WINNERS_COUNT,
} from "@/lib/tournament-model";

describe("3-day GRAM tournament rules", () => {
  it("uses 3-day cycles, 350 GRAM prize pool, +10/ad, +100/verified 0.05 TON referral", () => {
    expect(TOURNAMENT_DURATION_DAYS).toBe(3);
    expect(TOURNAMENT_PRIZE_POOL).toBe(350);
    expect(TOURNAMENT_AD_POINTS).toBe(10);
    expect(TOURNAMENT_REFERRAL_POINTS).toBe(100);
    expect(TOURNAMENT_VERIFY_TON).toBe(0.05);
  });

  it("distributes exactly 350 GRAM across the top 20 ranks", () => {
    expect(prizeForRank(1)).toBe(120);
    expect(prizeForRank(2)).toBe(70);
    expect(prizeForRank(3)).toBe(40);
    expect(prizeForRank(4)).toBe(10);
    expect(prizeForRank(10)).toBe(10);
    expect(prizeForRank(11)).toBe(5);
    expect(prizeForRank(20)).toBe(5);
    expect(prizeForRank(21)).toBe(0);
    expect(prizeForRank(0)).toBe(0);

    let total = 0;
    for (let r = 1; r <= TOURNAMENT_WINNERS_COUNT; r++) total += prizeForRank(r);
    expect(total).toBe(TOURNAMENT_PRIZE_POOL);
  });

  it("formats countdown for multi-day and sub-day remaining times", () => {
    const now = 1_700_000_000_000;
    expect(formatCountdown(now + (2 * 86400 + 5 * 3600 + 9 * 60) * 1000, now)).toBe("2ي 05س 09د");
    expect(formatCountdown(now + (3 * 3600 + 4 * 60 + 7) * 1000, now)).toBe("03س 04د 07ث");
    expect(formatCountdown(now - 5000, now)).toBe("00س 00د 00ث");
  });
});