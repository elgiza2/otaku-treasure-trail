import { describe, expect, it } from "vitest";
import { findSpinPack, raidSteal, regenSpins } from "@/lib/raid-model";

describe("raid rules", () => {
  it("regains one free spin per hour up to 5", () => {
    const at = new Date("2026-01-01T00:00:00Z");
    expect(regenSpins(2, at, new Date("2026-01-01T02:30:00Z"))).toBe(4);
    expect(regenSpins(0, at, new Date("2026-01-02T00:00:00Z"))).toBe(5);
  });
  it("keeps paid spins above the free cap", () => {
    expect(regenSpins(60, new Date(0), new Date())).toBe(60);
  });
  it("raid takes 10% capped at 50,000", () => {
    expect(raidSteal(2_000)).toBe(200);
    expect(raidSteal(10_000_000)).toBe(500);
  });
  it("spin packs cost 0.5 / 1 / 3 TON", () => {
    expect(findSpinPack("spins_20")).toMatchObject({ ton: 0.5, spins: 20 });
    expect(findSpinPack("spins_60")).toMatchObject({ ton: 1, spins: 60 });
    expect(findSpinPack("spins_250")).toMatchObject({ ton: 3, spins: 250 });
  });
});
