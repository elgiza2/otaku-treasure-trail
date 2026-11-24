import { describe, expect, it } from "vitest";
import { encounter, knockoutPenalty, playsLeft, PLAYS_PACK, stepReward, winChance } from "@/lib/novel-model";

describe("endless novel", () => {
  it("5 free plays a day, +1 per ad up to 3, plus bought plays", () => {
    expect(playsLeft({ playsUsed: 0, adsUsed: 0, bonus: 0 })).toBe(5);
    expect(playsLeft({ playsUsed: 5, adsUsed: 3, bonus: 0 })).toBe(3);
    expect(playsLeft({ playsUsed: 8, adsUsed: 3, bonus: 5 })).toBe(5);
  });
  it("TON pack gives 5 plays for 0.3 TON", () => {
    expect(PLAYS_PACK).toMatchObject({ ton: 0.3, plays: 5 });
  });
  it("gets harder each chapter, capped at -15%", () => {
    expect(winChance("safe", 1)).toBe(80);
    expect(winChance("bold", 11)).toBe(45);
    expect(winChance("reckless", 99)).toBe(15);
    expect(winChance("blade", 99)).toBe(100);
  });
  it("boss pays double", () => {
    expect(stepReward("bold", 1, 1)).toBe(2);
    expect(stepReward("bold", 1, 3)).toBe(4);
    expect(stepReward("reckless", 5, 2)).toBe(7);
  });
  it("knockout costs 50 coins x chapter, never below zero", () => {
    expect(knockoutPenalty(4, 1000)).toBe(4);
    expect(knockoutPenalty(4, 2)).toBe(2);
  });
  it("story never runs out", () => {
    expect(encounter(500, 2).title).toContain("فصل 500");
  });
});
