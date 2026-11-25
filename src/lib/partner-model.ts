import { BOT_USERNAME } from "./coin";
export const PARTNER_REWARD_GRAM = 0.01;
export const PARTNER_WITHDRAW_DAYS = 30;
export const PARTNER_POSTS_PER_DAY = 2;
export type PartnerChannel = { id: string; chat_id: number; title: string; username: string | null; status: string; joined_users: number; earned_gram: number; balance_gram: number; started_at: string; last_withdrawal_at: string | null; owner_tg: number; created_at: string };
export type DailyReport = { day: string; adsgram_views: number; monetag_views: number; new_channels: number; new_users: number; partner_users: number; partner_earned_gram: number; paid_ton: number; adsgram_revenue_usd: number | null; monetag_revenue_usd: number | null; costs_usd: number | null };
export function withdrawalOpensAt(start: string, last: string | null) { return Date.parse(last ?? start) + PARTNER_WITHDRAW_DAYS * 86_400_000; }
export function partnerLink(id: string) { return `https://t.me/${BOT_USERNAME}?startapp=channel_${id}&mode=fullscreen`; }
export function partnerSource(param: string | null) { const id = param?.startsWith("channel_") ? param.slice(8) : ""; return /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id) ? id : null; }
export function netRevenue(report: Pick<DailyReport, "adsgram_revenue_usd" | "monetag_revenue_usd" | "costs_usd">) { return report.adsgram_revenue_usd === null || report.monetag_revenue_usd === null || report.costs_usd === null ? null : report.adsgram_revenue_usd + report.monetag_revenue_usd - report.costs_usd; }