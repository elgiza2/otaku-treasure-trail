import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authPlayer } from "./tasks.functions";
import type { MinePass } from "./mine-pass-model";

export const getMinePass = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ initData: z.string().min(10).max(4096) }).parse(input))
  .handler(async ({ data }): Promise<{ pass: MinePass | null; pendingId: string | null }> => {
    const { user, db } = await authPlayer(data.initData);
    const [pass, pending] = await Promise.all([
      db.from("wall_mine_passes").select("pass_number, created_at").eq("tg_id", user.id).maybeSingle(),
      db.from("wall_payments").select("id").eq("tg_id", user.id).eq("pack", "mine_pass").eq("status", "pending").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (pass.error) throw new Error(pass.error.message);
    if (pending.error) throw new Error(pending.error.message);
    return { pass: pass.data ? { number: pass.data.pass_number, activatedAt: pass.data.created_at } : null, pendingId: pending.data?.id ?? null };
  });