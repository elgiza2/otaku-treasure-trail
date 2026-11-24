import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authPlayer } from "./tasks.functions";
import type { MintedNft, NftStock } from "./nft-model";

/** The caller's own minted cards, newest first, plus any unpaid mint to re-check. */
export const getMyNfts = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ initData: z.string().min(10).max(4096) }).parse(input))
  .handler(async ({ data }): Promise<{ nfts: MintedNft[]; pendingId: string | null }> => {
    const { user, db } = await authPlayer(data.initData);
    const [list, pending] = await Promise.all([
      db.from("wall_nfts").select("serial, design, created_at").eq("tg_id", user.id).order("serial", { ascending: false }).limit(100),
      db.from("wall_payments").select("id").eq("tg_id", user.id).eq("pack", "nft_mint").eq("status", "pending").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (list.error) throw new Error(list.error.message);
    if (pending.error) throw new Error(pending.error.message);
    return {
      nfts: (list.data ?? []).map((r) => ({ serial: Number(r.serial), design: r.design, mintedAt: r.created_at })),
      pendingId: pending.data?.id ?? null,
    };
  });

/** Copies left per card (public numbers, no player data). */
export const getNftStock = createServerFn({ method: "GET" }).handler(async (): Promise<{ stock: NftStock[] }> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("wall_nft_remaining" as never);
  if (error) throw new Error(error.message);
  return { stock: ((data ?? []) as NftStock[]).map((r) => ({ design: Number(r.design), cap: Number(r.cap), remaining: Number(r.remaining) })) };
});
