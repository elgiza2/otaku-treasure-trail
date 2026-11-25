import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authPlayer } from "./tasks.functions";
import { requireAdmin } from "./admin.functions";
import type { DailyReport, PartnerChannel } from "./partner-model";
const auth = z.object({ initData: z.string().min(10).max(4096) });
export const getMyChannels = createServerFn({ method: "POST" }).inputValidator((d: unknown) => auth.parse(d)).handler(async ({ data }) => {
  const { user, db } = await authPlayer(data.initData);
  const [channels, withdrawals] = await Promise.all([
    db.from("wall_partner_channels").select("*").eq("owner_tg", user.id).order("created_at", { ascending: false }),
    db.from("wall_partner_withdrawals").select("id, amount_gram, status, created_at, tx_hash").eq("owner_tg", user.id).order("created_at", { ascending: false }).limit(30),
  ]);
  if (channels.error || withdrawals.error) throw new Error("load_failed");
  return { channels: channels.data as PartnerChannel[], withdrawals: withdrawals.data };
});
export const requestPartnerWithdrawal = createServerFn({ method: "POST" }).inputValidator((d: unknown) => auth.extend({ channel: z.string().uuid(), address: z.string().trim().regex(/^(?:EQ|UQ)[A-Za-z0-9_-]{46}$/) }).parse(d)).handler(async ({ data }) => {
  const { user, db } = await authPlayer(data.initData);
  const r = await db.rpc("wall_partner_withdraw", { _tg: user.id, _channel: data.channel, _address: data.address });
  if (r.error) throw new Error(r.error.message);
  return { id: r.data };
});
export const getPartnerAdmin = createServerFn({ method: "POST" }).inputValidator((d: unknown) => auth.extend({ page: z.number().int().min(0).default(0) }).parse(d)).handler(async ({ data }) => {
  const { db } = await requireAdmin(data.initData, "owner");
  const generated = await db.rpc("wall_generate_daily_report");
  if (generated.error) throw new Error(generated.error.message);
  const [channels, reports, withdrawals, overview] = await Promise.all([
    db.from("wall_partner_channels").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(data.page * 50, data.page * 50 + 49),
    db.from("wall_daily_reports").select("*").order("day", { ascending: false }).limit(30),
    db.from("wall_partner_withdrawals").select("*").eq("status", "pending").order("created_at").limit(100),
    db.rpc("wall_partner_overview"),
  ]);
  if (channels.error || reports.error || withdrawals.error || overview.error) throw new Error("load_failed");
  return { channels: channels.data as PartnerChannel[], count: channels.count ?? 0, reports: reports.data as DailyReport[], withdrawals: withdrawals.data, overview: overview.data as { adsgramViews: number; monetagViews: number; newChannels: number; newUsers: number; partnerEarnedGram: number } };
});
export const saveDailyRevenue = createServerFn({ method: "POST" }).inputValidator((d: unknown) => auth.extend({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), adsgram: z.number().min(0).max(1e8), monetag: z.number().min(0).max(1e8), costs: z.number().min(0).max(1e8) }).parse(d)).handler(async ({ data }) => {
  const { db } = await requireAdmin(data.initData, "owner");
  if (!Number.isFinite(Date.parse(data.day))) throw new Error("bad_date");
  const r = await db.from("wall_daily_reports").update({ adsgram_revenue_usd: data.adsgram, monetag_revenue_usd: data.monetag, costs_usd: data.costs }).eq("day", data.day).select("day").single();
  if (r.error) throw new Error(r.error.message);
  return { ok: true };
});
export const reviewPartnerWithdrawal = createServerFn({ method: "POST" }).inputValidator((d: unknown) => auth.extend({ id: z.string().uuid(), paid: z.boolean(), tx: z.string().trim().max(150).optional() }).parse(d)).handler(async ({ data }) => {
  const { db } = await requireAdmin(data.initData, "owner");
  const r = await db.rpc("wall_partner_review_withdrawal", { _id: data.id, _paid: data.paid, ...(data.tx ? { _tx: data.tx } : {}) });
  if (r.error) throw new Error(r.error.message);
  return { ok: true };
});