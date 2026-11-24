import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authPlayer } from "./tasks.functions";

const auth = z.object({ initData: z.string().min(10).max(4096) });

export const getAnime = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => auth.parse(i))
  .handler(async ({ data }) => {
    const { user, db } = await authPlayer(data.initData);
    const [a, u, w] = await Promise.all([
      db.from("wall_anime").select("balance, claimed_at").eq("tg_id", user.id).maybeSingle(),
      db.from("wall_users").select("created_at, total_level").eq("tg_id", user.id).single(),
      db.from("wall_withdrawals").select("id, amount, status, created_at").eq("tg_id", user.id).order("created_at", { ascending: false }).limit(5),
    ]);
    if (a.error || u.error || w.error) throw new Error("load_failed");
    return {
      balance: Number(a.data?.balance ?? 0),
      claimedAt: a.data?.claimed_at ? Date.parse(a.data.claimed_at) : null,
      joinedAt: Date.parse(u.data.created_at),
      level: Math.max(1, Number(u.data.total_level ?? 1)),
      withdrawals: (w.data ?? []).map((r) => ({ id: r.id, amount: Number(r.amount), status: r.status, createdAt: r.created_at })),
    };
  });

export const claimAnime = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => auth.parse(i))
  .handler(async ({ data }) => {
    const { user, db } = await authPlayer(data.initData);
    const { data: amt, error } = await db.rpc("wall_anime_claim" as never, { _tg: user.id } as never);
    if (error) throw new Error(error.message.includes("too_early") ? "too_early" : "failed");
    return { amount: Number(amt) };
  });

export const withdrawAnime = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => auth.extend({ amount: z.number().min(10_000).max(1e9), address: z.string().trim().min(20).max(128) }).parse(i))
  .handler(async ({ data }) => {
    const { user, db } = await authPlayer(data.initData);
    const { error } = await db.rpc("wall_anime_withdraw" as never, { _tg: user.id, _amount: data.amount, _address: data.address } as never);
    if (error) {
      const m = error.message;
      throw new Error(m.includes("too_new") ? "too_new" : m.includes("insufficient") ? "insufficient" : m.includes("min_amount") ? "min_amount" : "failed");
    }
    return { ok: true };
  });
