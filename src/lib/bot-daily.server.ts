import { bt, type BotKey } from "@/lib/bot-i18n";
// Daily bot reminders + one chat gift per day. Rules mirrored by wall_today_gift / wall_claim_gift.
export const DAILY_GIFT_COINS = 50;
export const SLOT_HOURS_UTC = [8, 14, 20] as const; // 3 reminders a day
export const BATCH = 150; // max messages per run; the scheduler calls again for the rest

const APP_URL = "https://t.me/Mixsaabot?startapp";

/** The latest slot that has started, e.g. "2026-11-17T14". */
export function currentSlot(now = new Date()): { key: string; hour: number } {
  const h = now.getUTCHours();
  const past = SLOT_HOURS_UTC.filter((s) => s <= h);
  const d = new Date(now);
  let hour: number;
  if (past.length) hour = past[past.length - 1]!;
  else { d.setUTCDate(d.getUTCDate() - 1); hour = SLOT_HOURS_UTC[SLOT_HOURS_UTC.length - 1]!; }
  return { key: `${d.toISOString().slice(0, 10)}T${String(hour).padStart(2, "0")}`, hour };
}

const TEXTS: Record<number, [string, BotKey, BotKey, BotKey]> = {
  8: ["🎁", "gift1", "gift2", "gift3"],
  14: ["⚔️", "wall1", "wall2", "wall3"],
  20: ["📖", "night1", "night2", "night3"],
};

export function slotMessage(hour: number, name: string, giftId: string | null, lang?: string | null) {
  const [e, a, b, c] = TEXTS[hour]!;
  const v = { name, coins: DAILY_GIFT_COINS };
  const text = `<b>${e} ${bt(lang, a, v)}</b>\n\n<b>${bt(lang, b, v)}</b>\n${bt(lang, c, v)}`;
  const rows: unknown[][] = [];
  if (giftId) rows.push([{ text: `🎁 ${bt(lang, "claim", v)}`, callback_data: `gift:${giftId}`, style: "success" }]);
  rows.push([{ text: `⚔️ ${bt(lang, "open")}`, url: APP_URL, style: "primary" }]);
  return { text, reply_markup: { inline_keyboard: rows } };
}

export async function cronSecret(token: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`wall-cron:${token}`));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
