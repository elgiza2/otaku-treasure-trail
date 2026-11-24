// Rewarded ad via Monetag (zone below is a public id). Loaded lazily in the browser only.
const ZONE = "12281067";
const FN = `show_${ZONE}`;
export const AD_PLACEHOLDER_SECONDS = 15;
export const hasRealAds = true;

type ShowFn = (o?: unknown) => Promise<void>;
function getFn() { return (window as unknown as Record<string, ShowFn | undefined>)[FN]; }

async function loadSdk() {
  if (getFn()) return getFn()!;
  await new Promise<void>((ok, bad) => {
    const s = document.createElement("script");
    s.src = "https://libtl.com/sdk.js";
    s.dataset["zone"] = ZONE; s.dataset["sdk"] = FN;
    s.onload = () => ok(); s.onerror = () => bad(new Error("ad_load"));
    document.head.appendChild(s);
  });
  for (let i = 0; i < 20 && !getFn(); i++) await new Promise((r) => setTimeout(r, 150));
  if (!getFn()) throw new Error("ad_load");
  return getFn()!;
}

/** Resolves true only when the rewarded ad was watched to the end. */
export async function showRealAd(): Promise<boolean> {
  try { await (await loadSdk())(); return true; } catch { return false; }
}
