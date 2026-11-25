import { showAdsgramAd } from "@/lib/adsgram";
import { showRewardedAd } from "@/lib/monetag";
import type { AdProvider } from "@/lib/tournament-model";

let nextIndex = 0;
const PROVIDERS: readonly AdProvider[] = ["adsgram", "monetag"];

/**
 * Runs Adsgram and Monetag together behind one button: alternates providers
 * on each watch and falls back to the second network if the first has no fill.
 */
export async function showDualAd(): Promise<AdProvider> {
  const first = PROVIDERS[nextIndex % PROVIDERS.length] ?? "adsgram";
  const second: AdProvider = first === "adsgram" ? "monetag" : "adsgram";
  nextIndex++;
  try {
    if (first === "adsgram") await showAdsgramAd();
    else await showRewardedAd();
    return first;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "ad_skipped") throw err;
    if (second === "adsgram") await showAdsgramAd();
    else await showRewardedAd();
    return second;
  }
}