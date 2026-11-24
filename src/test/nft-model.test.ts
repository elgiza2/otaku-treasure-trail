import { describe, expect, it } from "vitest";
import { NFT_DESIGNS, NFT_MINT_NANO, NFT_MINT_TON, rollDesign } from "@/lib/nft-model";
import { toNano } from "@/lib/shop-model";

describe("NFT mint", () => {
  it("each mint costs 5 TON", () => {
    expect(NFT_MINT_TON).toBe(5);
    expect(toNano(NFT_MINT_TON)).toBe(5_000_000_000n);
    expect(NFT_MINT_NANO).toBe(5_000_000_000n);
  });
  it("random pick covers every design with weights adding to 100%", () => {
    expect(NFT_DESIGNS.reduce((s, d) => s + d.weight, 0)).toBe(100);
    expect(rollDesign(0)).toBe(1);
    expect(rollDesign(0.49)).toBe(1);
    expect(rollDesign(0.5)).toBe(2);
    expect(rollDesign(0.79)).toBe(2);
    expect(rollDesign(0.8)).toBe(3);
    expect(rollDesign(0.94)).toBe(3);
    expect(rollDesign(0.95)).toBe(4);
    expect(rollDesign(0.9999)).toBe(4);
  });
});

import { NFT_ALREADY_TAKEN, NFT_TOTAL_SUPPLY, pickFromRemaining, stockLeft } from "@/lib/nft-model";

describe("NFT limited supply", () => {
  it("10,000 total, 9,164 already taken, 836 left to mint", () => {
    expect(NFT_DESIGNS.reduce((s, d) => s + d.cap, 0)).toBe(NFT_TOTAL_SUPPLY);
    expect(NFT_DESIGNS.reduce((s, d) => s + d.reserved, 0)).toBe(NFT_ALREADY_TAKEN);
    expect(NFT_TOTAL_SUPPLY - NFT_ALREADY_TAKEN).toBe(836);
  });
  it("never gives a card that has no copies left", () => {
    const stock = [{ design: 1, cap: 5000, remaining: 0 }, { design: 2, cap: 3000, remaining: 3 }, { design: 3, cap: 1500, remaining: 0 }, { design: 4, cap: 500, remaining: 1 }];
    expect(pickFromRemaining(0, stock)).toBe(2);
    expect(pickFromRemaining(0.74, stock)).toBe(2);
    expect(pickFromRemaining(0.75, stock)).toBe(4);
    expect(stockLeft(stock)).toBe(4);
  });
  it("sold out gives nothing", () => {
    expect(pickFromRemaining(0.5, [{ design: 1, cap: 5000, remaining: 0 }])).toBeNull();
  });
});
