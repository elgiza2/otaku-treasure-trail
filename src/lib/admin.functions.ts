import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authPlayer } from "./tasks.functions";

export type AdminRole = "owner" | "tasks";
const auth = z.object({ initData: z.string().min(10).max(4096) });

/** Resolves the caller's admin role from the verified Telegram username. Never trusts the browser. */
export async function requireAdmin(initData: string, need: AdminRole | "any") {
  const { user, db } = await authPlayer(initData);
  const name = (user.username ?? "").toLowerCase();
  const { data } = await db.from("wall_admins" as never).select("role").eq("username", name).maybeSingle();
  const role = (data as { role?: AdminRole } | null)?.role;
  if (!role || (need === "owner" && role !== "owner")) throw new Error("forbidden");
  return { db, role, user };
}

export const adminMe = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => auth.parse(d))
  .handler(async ({ data }) => {
    try {
      const { role } = await requireAdmin(data.initData, "any");
      return { role: role as AdminRole | null };
    } catch {
      return { role: null };
    }
  });

export const adminStats = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => auth.parse(d))
  .handler(async ({ data }) => {
    const { db } = await requireAdmin(data.initData, "owner");
    const day = new Date(Date.now() - 864e5).toISOString();
    const count = async (t: string, f?: (q: any) => any) => {
      let q: any = db.from(t as never).select("*", { count: "exact", head: true });
      if (f) q = f(q);
      const { count: c } = await q;
      return c ?? 0;
    };
    const [users, active, newUsers, nfts, pendingW] = await Promise.all([
      count("wall_users"),
      count("wall_users", (q) => q.gte("last_seen_at", day)),
      count("wall_users", (q) => q.gte("created_at", day)),
      count("wall_nfts"),
      count("wall_withdrawals", (q) => q.eq("status", "pending")),
    ]);
    const { data: pays } = await db.from("wall_payments").select("pack, amount_nano, paid_at, tg_id").eq("status", "paid").order("paid_at", { ascending: false }).limit(500);
    const paid = pays ?? [];
    const ton = (rows: typeof paid) => rows.reduce((s, p) => s + Number(p.amount_nano) / 1e9, 0);
    const { data: admins } = await db.from("wall_admins" as never).select("username, role").order("role");
    return {
      users, active, newUsers, nfts, pendingWithdrawals: pendingW,
      paidCount: paid.length,
      tonTotal: ton(paid),
      tonToday: ton(paid.filter((p) => p.paid_at && p.paid_at >= day)),
      recent: paid.slice(0, 10).map((p) => ({ pack: p.pack, ton: Number(p.amount_nano) / 1e9, at: p.paid_at, tg: Number(p.tg_id) })),
      admins: (admins ?? []) as { username: string; role: AdminRole }[],
    };
  });

const taskShape = z.object({
  title: z.string().trim().min(2).max(80),
  url: z.string().trim().url().max(300).nullable(),
  chat_id: z.string().trim().max(40).nullable(),
  category: z.enum(["daily", "partners", "social", "invite"]).or(z.string().min(1).max(20)),
  kind: z.string().min(1).max(20),
  reward: z.number().min(0).max(1_000_000),
  emoji: z.string().min(1).max(40),
  sort: z.number().int().min(-1000).max(1000),
  active: z.boolean(),
});

export const adminListTasks = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => auth.parse(d))
  .handler(async ({ data }) => {
    const { db } = await requireAdmin(data.initData, "any");
    const { data: rows, error } = await db.from("wall_tasks").select("id, title, url, chat_id, category, kind, reward, emoji, sort, active").order("sort");
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({ ...r, reward: Number(r.reward) }));
  });

export const adminSaveTask = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => auth.extend({ id: z.string().uuid().nullable(), task: taskShape }).parse(d))
  .handler(async ({ data }) => {
    const { db } = await requireAdmin(data.initData, "any");
    const q = data.id ? db.from("wall_tasks").update(data.task).eq("id", data.id) : db.from("wall_tasks").insert(data.task);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteTask = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => auth.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { db } = await requireAdmin(data.initData, "any");
    const { error } = await db.from("wall_tasks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSetHelper = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    auth.extend({ username: z.string().trim().regex(/^@?[A-Za-z0-9_]{4,32}$/), remove: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const { db } = await requireAdmin(data.initData, "owner");
    const name = data.username.replace(/^@/, "").toLowerCase();
    if (data.remove) {
      const { error } = await db.from("wall_admins" as never).delete().eq("username", name).eq("role", "tasks");
      if (error) throw new Error(error.message);
    } else {
      const { error } = await db.from("wall_admins" as never).upsert({ username: name, role: "tasks" } as never, { onConflict: "username", ignoreDuplicates: true });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
