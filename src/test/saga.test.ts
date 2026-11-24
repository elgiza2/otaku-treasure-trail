import { describe, expect, it } from "vitest";
import { hasPicked, pickKey, sagaChapter, sagaLines, SAGA } from "@/lib/saga";

describe("saga story", () => {
  it("has 30 authored chapters, then starts a harder new cycle", () => {
    expect(SAGA).toHaveLength(30);
    expect(sagaChapter(31)).toMatchObject({ index: 0, season: 2 });
  });
  it("later chapters remember an earlier choice", () => {
    const saved = sagaLines(2, { bond: "levi", picks: { c1: 0 } }, "Ali").map((l) => l.text).join(" ");
    expect(saved).toContain("أمك عايشة");
    expect(saved).not.toContain("الشارع اتحمى");
  });
  it("each chapter's choice is made once", () => {
    expect(pickKey(3)).toBe("c3");
    expect(hasPicked(3, { picks: { c3: 1 } })).toBe(true);
    expect(hasPicked(33, { picks: { c3: 1 } })).toBe(false);
  });
});
