// Adsgram rewarded ad (SDK loaded in __root). Block ID 61733 (Reward type).
export const ADSGRAM_BLOCK_ID = (import.meta.env["VITE_ADSGRAM_BLOCK_ID"] as string | undefined) || "61733";

type AdsgramResult = { done: boolean; description?: string; state?: string; error?: boolean };
type AdsgramController = { show: () => Promise<AdsgramResult> };
type AdsgramSdk = { init: (opts: { blockId: string }) => AdsgramController };

export async function showAdsgramAd(): Promise<void> {
  const sdk = (window as unknown as { Adsgram?: AdsgramSdk }).Adsgram;
  if (!sdk || typeof sdk.init !== "function") throw new Error("ad_unavailable");
  const controller = sdk.init({ blockId: String(ADSGRAM_BLOCK_ID) });
  const res = await controller.show();
  if (!res?.done || res.error) throw new Error("ad_skipped");
}