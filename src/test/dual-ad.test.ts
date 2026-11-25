import { beforeEach, describe, expect, it, vi } from "vitest";

const showAdsgramAd = vi.fn<() => Promise<void>>();
const showRewardedAd = vi.fn<() => Promise<void>>();

vi.mock("@/lib/adsgram", () => ({ showAdsgramAd }));
vi.mock("@/lib/monetag", () => ({ showRewardedAd }));

describe("showDualAd", () => {
  beforeEach(() => {
    showAdsgramAd.mockReset();
    showRewardedAd.mockReset();
  });

  it("alternates Adsgram and Monetag behind a single button", async () => {
    showAdsgramAd.mockResolvedValue();
    showRewardedAd.mockResolvedValue();
    const { showDualAd } = await import("@/lib/dual-ad");
    const first = await showDualAd();
    const second = await showDualAd();
    expect(first).not.toBe(second);
    expect([first, second].sort()).toEqual(["adsgram", "monetag"]);
  });

  it("falls back to the second network when the first has no fill", async () => {
    showAdsgramAd.mockRejectedValue(new Error("ad_unavailable"));
    showRewardedAd.mockResolvedValue();
    const { showDualAd } = await import("@/lib/dual-ad");
    const used = await showDualAd();
    expect(used).toBe("monetag");
  });

  it("does not fall back when the user skips the ad", async () => {
    showAdsgramAd.mockRejectedValue(new Error("ad_skipped"));
    showRewardedAd.mockRejectedValue(new Error("ad_skipped"));
    const { showDualAd } = await import("@/lib/dual-ad");
    await expect(showDualAd()).rejects.toThrow("ad_skipped");
  });
});