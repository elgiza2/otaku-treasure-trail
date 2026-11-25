import { BOT_USERNAME } from "./coin";

export const ENERGY_MAX = 100;
export const ENERGY_COST = 20;
export const ENERGY_REGEN_MS = 120_000;
export const WHEEL_GRAM_PRIZE = 3;
export const SQUAD_PRIZE_POOL = 10;
export const SQUAD_PRIZES = [5, 3, 2] as const;
export type AdBenefit = "spin" | "energy" | "double";
export type EnergyState = { energy: number; regeneratedAt: string };
export type Squad = { id: string; name: string; emblem: string; members: number; points: number; ads: number; referrals: number; rank: number; prize: number };
export type SquadBoard = { week: string; endsAt: string; squads: Squad[]; previous: Squad[] };
export function energyNow(state: EnergyState, now: number) {
  return Math.min(ENERGY_MAX, state.energy + Math.max(0, Math.floor((now - Date.parse(state.regeneratedAt)) / ENERGY_REGEN_MS)));
}
export function doubleLoot(amount: number) { return amount * 2; }
export function squadLink(id: string) { return `https://t.me/${BOT_USERNAME}?startapp=squad_${id}&mode=fullscreen`; }
export function squadStartParam(initData: string) {
  const value = new URLSearchParams(initData).get("start_param") ?? "";
  const id = value.startsWith("squad_") ? value.slice(6) : "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : null;
}
export function gameError(error: unknown) {
  const msg = error instanceof Error ? error.message : "";
  if (msg.includes("no_energy")) return "الطاقة خلصت، اشحنها أو استنى تتجدد";
  if (msg.includes("no_loot")) return "مفيش غنيمة جاهزة للاستلام";
  if (msg.includes("already_in_squad")) return "اخرج من تحالفك الحالي الأول";
  if (msg.includes("ad_skipped")) return "الإعلان ما اكتملش، المكافأة لسه ما اتضافتش";
  if (msg.includes("ad_unavailable")) return "مفيش إعلان متاح دلوقتي، جرّب الشبكة التانية";
  return "ما قدرناش نكمل، جرّب تاني";
}