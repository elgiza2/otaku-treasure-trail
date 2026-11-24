// Temporary coin identity — the final name comes from the owner later; change it here only.
export const COIN = { symbol: "ANIME", name: "Animecoin" } as const;

export const BOT_USERNAME = "Mixsaabot";

export function referralLink(tgId: number | string): string {
  return `https://t.me/${BOT_USERNAME}?startapp=ref_${tgId}&mode=fullscreen`;
}

export function formatAmount(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString("en-US") : n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
