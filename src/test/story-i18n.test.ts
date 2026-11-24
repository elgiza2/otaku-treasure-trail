import { describe, expect, it } from "vitest";
import { LANGS } from "@/i18n";
import { matchesAnyLanguage, riddleText, RIDDLES_I18N } from "@/lib/story-i18n.server";

describe("riddles in every language", () => {
  it("every non-Arabic app language has all 4 riddle chapters", () => {
    for (const l of LANGS.filter((x) => x !== "ar")) expect(RIDDLES_I18N[l]?.length, l).toBe(4);
  });
  it("Arabic players get the original DB text", () => {
    expect(riddleText("ar", 1)).toBeNull();
  });
  it("a right answer counts in any language", () => {
    expect(matchesAnyLanguage(2, "Star")).toBe(true);
    expect(matchesAnyLanguage(4, "clé")).toBe(true);
    expect(matchesAnyLanguage(3, "宝藏")).toBe(true);
  });
  it("a wrong answer or another day's answer does not count", () => {
    expect(matchesAnyLanguage(2, "wall")).toBe(false);
    expect(matchesAnyLanguage(1, "")).toBe(false);
  });
});
