import { beginCell } from "@ton/core";
import { describe, expect, it } from "vitest";
import { adReward, commentPayload, findPack, toNano } from "@/lib/shop-model";

describe("TON shop", () => {
  it("comment payload matches the official TON encoder", () => {
    const text = "wall:7fa5c07c-20e3-4cb5-a9f0-410444cebd98";
    const ref = beginCell().storeUint(0, 32).storeStringTail(text).endCell().toBoc({ idx: false, crc32: false }).toString("base64");
    expect(commentPayload(text)).toBe(ref);
  });
  it("1 TON pack gives 1,070 coins (30% under market)", () => expect(findPack("soldier")?.coins).toBe(1_070));
  it("0.5 TON in nano", () => expect(toNano(0.5)).toBe(500_000_000n));
});

describe("rewarded ads", () => {
  it("pays at least 100", () => expect(adReward(10)).toBe(100));
  it("pays one hour of mining", () => expect(adReward(640)).toBe(640));
});
