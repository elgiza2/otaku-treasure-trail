import { describe, expect, it } from "vitest";
import { chapterForDay, findStoryItem, maskAnswer, normalizeAnswer, solveCoins } from "@/lib/story-model";

describe("story riddles", () => {
  it("accepts answers with or without ال, spaces and hamza variants", () => {
    expect(normalizeAnswer(" السور ")).toBe(normalizeAnswer("سور"));
    expect(normalizeAnswer("أمل")).toBe(normalizeAnswer("امل"));
  });
  it("gives the first 10 solvers a 2000 bonus and nobody after", () => {
    expect(solveCoins(5000, 10)).toBe(7000);
    expect(solveCoins(5000, 11)).toBe(5000);
  });
  it("rotates to a new chapter each day and wraps after the last", () => {
    expect(chapterForDay(new Date(Date.UTC(2026, 0, 1)), 4)).toBe(1);
    expect(chapterForDay(new Date(Date.UTC(2026, 0, 2)), 4)).toBe(2);
    expect(chapterForDay(new Date(Date.UTC(2026, 0, 5)), 4)).toBe(1);
  });
  it("shows only the revealed letters", () => {
    expect(maskAnswer("كنز", 1)).toBe("ك _ _");
  });
  it("prices items at 0.2 / 0.3 / 0.5 TON", () => {
    expect(findStoryItem("story_hint")?.ton).toBe(0.2);
    expect(findStoryItem("story_letter")?.ton).toBe(0.3);
    expect(findStoryItem("story_tries_3")?.ton).toBe(0.5);
  });
});
