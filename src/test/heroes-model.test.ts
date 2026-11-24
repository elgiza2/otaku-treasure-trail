import { describe, expect, it } from "vitest";
import { heroCost, heroRate, isUnlocked, pendingCoins, TOTAL_MAX } from "@/lib/heroes-model";

describe("heroes economy", () => {
  it("5 heroes x 200 levels = 1000", () => expect(TOTAL_MAX).toBe(1000));
  it("first hero level 1 mines 1/h", () => expect(heroRate(0, 1)).toBe(1));
  it("first upgrade costs 100", () => expect(heroCost(0, 0)).toBe(100));
  it("hero 2 locked until hero 1 hits 200", () => {
    expect(isUnlocked(1, [199])).toBe(false);
    expect(isUnlocked(1, [200])).toBe(true);
  });
  it("storage caps at 3 hours", () => expect(pendingCoins(10, 0, 10 * 3_600_000)).toBe(30));
});

import { titansSlain as ts, coinsPerTitan as cpt } from "@/lib/heroes-model";
describe("battle titans", () => {
  it("one titan per minute", () => expect(ts(0, 5 * 60_000 + 30_000)).toBe(5));
  it("stops at full 3h storage", () => expect(ts(0, 10 * 3_600_000)).toBe(180));
  it("titan reward is a minute of mining", () => expect(cpt(120)).toBe(2));
});
