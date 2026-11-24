import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import type { PlayerDTO, ProgressDTO, TaskCategory, TaskDTO, TaskKind } from "./tasks-model";
import { isChatMember, verifyInitData } from "./telegram.server";

type TaskRow = Database["public"]["Tables"]["wall_tasks"]["Row"];

function toTaskDTO(r: TaskRow): TaskDTO {
  return {
    id: r.id,
    category: r.category as TaskCategory,
    kind: r.kind as TaskKind,
    title: r.title,
    url: r.url,
    reward: Number(r.reward),
    cooldownHours: r.cooldown_hours,
    required: r.required,
    emoji: r.emoji,
    sort: r.sort,
  };
}

function botToken(): string {
  const t = process.env["TELEGRAM_BOT_TOKEN"];
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  return t;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Verifies the Telegram session and makes sure the player row exists. */
export async function authPlayer(initData: string) {
  const { user, startParam } = await verifyInitData(initData, botToken());
  const ref = startParam?.match(/^ref_(\d+)$/)?.[1];
  const db = await admin();
  const { error } = await db.rpc("wall_upsert_user", {
    _tg: user.id,
    _username: user.username ?? null,
    _first: user.first_name ?? "",
    _photo: user.photo_url ?? null,
    _ref: ref ? Number(ref) : null,
  } as never);
  if (error) throw new Error(error.message);
  if (user.language_code) await db.from("wall_users").update({ language_code: user.language_code } as never).eq("tg_id", user.id);
  return { user, db };
}

const authInput = z.object({ initData: z.string().min(10).max(4096) });
const taskInput = authInput.extend({ taskId: z.string().uuid() });

/** Public task list (no player state) — safe to render on the server. */
export const listTasks = createServerFn({ method: "GET" }).handler(async (): Promise<TaskDTO[]> => {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const db = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data, error } = await db.from("wall_tasks").select("*").eq("active", true).order("sort");
  if (error) throw new Error(error.message);
  return (data ?? []).map(toTaskDTO);
});

export const getMyBoard = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => authInput.parse(d))
  .handler(async ({ data }): Promise<{ player: PlayerDTO; progress: ProgressDTO[] }> => {
    const { user, db } = await authPlayer(data.initData);
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
    const [u, p, refs, week] = await Promise.all([
      db.from("wall_users").select("*").eq("tg_id", user.id).single(),
      db.from("wall_task_progress").select("task_id, started_at, last_claimed_at").eq("tg_id", user.id),
      db.from("wall_users").select("tg_id", { count: "exact", head: true }).eq("referrer_id", user.id),
      db.from("wall_checkins").select("reward").eq("tg_id", user.id).gte("created_at", weekAgo),
    ]);
    if (u.error) throw new Error(u.error.message);
    return {
      player: {
        tgId: Number(u.data.tg_id),
        firstName: u.data.first_name,
        balance: Number(u.data.balance),
        wallet: u.data.wallet_address,
        streak: u.data.checkin_streak,
        lastCheckinAt: u.data.last_checkin_at,
        referrals: refs.count ?? 0,
        weekEarned: (week.data ?? []).reduce((s, r) => s + Number(r.reward), 0),
      },
      progress: (p.data ?? []).map((r) => ({
        taskId: r.task_id,
        startedAt: r.started_at,
        lastClaimedAt: r.last_claimed_at,
      })),
    };
  });

export const claimCheckin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => authInput.parse(d))
  .handler(async ({ data }) => {
    const { user, db } = await authPlayer(data.initData);
    const { data: res, error } = await db.rpc("wall_daily_checkin", { _tg: user.id } as never);
    if (error) throw new Error(error.message);
    return res as { streak_day: number; reward: number };
  });

export const startTask = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => taskInput.parse(d))
  .handler(async ({ data }) => {
    const { user, db } = await authPlayer(data.initData);
    const { error } = await db.rpc("wall_start_task", { _tg: user.id, _task: data.taskId } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const claimTask = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => taskInput.parse(d))
  .handler(async ({ data }) => {
    const { user, db } = await authPlayer(data.initData);
    const { data: task } = await db.from("wall_tasks").select("chat_id, kind").eq("id", data.taskId).single();
    let verified = false;
    if (task?.kind === "telegram" && task.chat_id) {
      const member = await isChatMember(botToken(), task.chat_id, user.id);
      if (member === false) throw new Error("not_joined");
      verified = member === true;
    }
    const { data: reward, error } = await db.rpc("wall_claim_task", {
      _tg: user.id,
      _task: data.taskId,
      _verified: verified,
    } as never);
    if (error) throw new Error(error.message);
    return { reward: Number(reward) };
  });

export const saveWallet = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    authInput.extend({ address: z.string().min(40).max(120) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { user, db } = await authPlayer(data.initData);
    const { error } = await db.from("wall_users").update({ wallet_address: data.address }).eq("tg_id", user.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
