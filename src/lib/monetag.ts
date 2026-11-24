// Monetag rewarded interstitial (SDK loaded in __root). Resolves once the ad was watched.
const SDK_FN = "show_12281067";

export async function showRewardedAd(): Promise<void> {
  const fn = (window as unknown as Record<string, unknown>)[SDK_FN];
  if (typeof fn !== "function") throw new Error("ad_unavailable");
  await (fn as () => Promise<unknown>)();
}
