import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authPlayer } from "./tasks.functions";
import type { RaidState, SpinResult } from "./raid-model";

const authInput = z.object({ initData: z.string().min(10).max(4096) });

/** Caller's spins/shields/keys, the shared vault pot and raids against the caller. */
export const getRaidState = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => authInput.parse(d))
  .handler(async ({ data }): Promise<RaidState> => {
    const { user, db } = await authPlayer(data.initData);
    const st = await db.rpc("wall_raid_load" as never, { _tg: user.id } as never);
    if (st.error) throw new Error(st.error.message);
    const s = st.data as unknown as { spins: number; spins_at: string; shields: number; keys: number };
    const [vault, raids, pending] = await Promise.all([
      db.from("wall_vault" as never).select("pot, last_win").eq("id", 1).single(),
      db.from("wall_raids" as never).select("id, attacker, amount, blocked, avenged, created_at").eq("victim", user.id).order("created_at", { ascending: false }).limit(10),
      db.from("wall_payments").select("id").eq("tg_id", user.id).in("pack", ["spins_20", "spins_60", "spins_250"]).eq("status", "pending").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (vault.error) throw new Error(vault.error.message);
    if (raids.error) throw new Error(raids.error.message);
    const rows = (raids.data ?? []) as unknown as { id: number; attacker: number; amount: number; blocked: boolean; avenged: boolean; created_at: string }[];
    const ids = [...new Set(rows.map((r) => r.attacker))];
    const names = new Map<number, string>();
    if (ids.length) {
      const u = await db.from("wall_users").select("tg_id, first_name, username").in("tg_id", ids);
      for (const r of u.data ?? []) names.set(Number(r.tg_id), r.first_name || r.username || "جندي مجهول");
    }
    const v = vault.data as unknown as { pot: number; last_win: number | null };
    return {
      spins: s.spins, spinsAt: s.spins_at, shields: s.shields, keys: s.keys,
      pot: Number(v.pot), lastWin: v.last_win == null ? null : Number(v.last_win),
      attacks: rows.map((r) => ({ id: Number(r.id), attacker: names.get(Number(r.attacker)) ?? "جندي مجهول", amount: Number(r.amount), blocked: r.blocked, avenged: r.avenged, at: r.created_at })),
      pendingId: pending.data?.id ?? null,
    };
  });

/** One spin; the server alone decides the result. Pass `revenge` to hit back a raid on you. */
export const spinRaid = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => authInput.extend({ revenge: z.number().int().positive().optional() }).parse(d))
  .handler(async ({ data }): Promise<SpinResult> => {
    const { user, db } = await authPlayer(data.initData);
    const r = await db.rpc("wall_game_spin", { _tg: user.id, ...(data.revenge ? { _revenge: data.revenge } : {}) });
    if (r.error) throw new Error(r.error.message);
    const j = r.data as unknown as { segment: SpinResult["segment"]; amount: number; blocked: boolean };
    return { segment: j.segment, amount: Number(j.amount), blocked: !!j.blocked };
  });
