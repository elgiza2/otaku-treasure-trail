import { PLAYS_PACK } from "./novel-model";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { commentPayload, findPack, paymentComment, toNano, TREASURY_ADDRESS } from "./shop-model";
import { authPlayer } from "./tasks.functions";
import { MINE_PASS_TON } from "./mine-pass-model";
import { NFT_MINT_TON, type MintedNft } from "./nft-model";
import { findSpinPack } from "./raid-model";
import { findStoryItem } from "./story-model";

const authInput = z.object({ initData: z.string().min(10).max(4096) });

/** Creates a pending TON purchase and returns what the wallet must send. */
export const createTonPayment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => authInput.extend({ pack: z.string().max(20) }).parse(d))
  .handler(async ({ data }) => {
    const pack = data.pack === "mine_pass" ? { id: "mine_pass", ton: MINE_PASS_TON, coins: 0 }
      : data.pack === "nft_mint" ? { id: "nft_mint", ton: NFT_MINT_TON, coins: 0 }
      : findSpinPack(data.pack) ? { id: data.pack, ton: findSpinPack(data.pack)!.ton, coins: 0 }
      : data.pack === PLAYS_PACK.id ? { id: PLAYS_PACK.id, ton: PLAYS_PACK.ton, coins: 0 }
      : findStoryItem(data.pack) ? { id: data.pack, ton: findStoryItem(data.pack)!.ton, coins: 0 }
      : findPack(data.pack);
    if (!pack) throw new Error("bad_pack");
    const { user, db } = await authPlayer(data.initData);
    if (pack.id === "nft_mint") {
      const stock = await db.rpc("wall_nft_remaining" as never);
      if (stock.error) throw new Error(stock.error.message);
      const left = ((stock.data ?? []) as { remaining: number }[]).reduce((n, r) => n + Math.max(Number(r.remaining), 0), 0);
      if (left <= 0) throw new Error("sold_out");
      // Reuse an unpaid mint so a retried wallet transfer is never charged twice.
      const pending = await db.from("wall_payments").select("id, amount_nano").eq("tg_id", user.id).eq("pack", "nft_mint").eq("status", "pending").order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (pending.error) throw new Error(pending.error.message);
      if (pending.data) return { id: pending.data.id, address: TREASURY_ADDRESS, amount: String(pending.data.amount_nano), payload: commentPayload(paymentComment(pending.data.id)) };
    }
    if (pack.id === "mine_pass") {
      const pass = await db.from("wall_mine_passes").select("pass_number").eq("tg_id", user.id).maybeSingle();
      if (pass.error) throw new Error(pass.error.message);
      if (pass.data) throw new Error("pass_already_active");
      const pending = await db.from("wall_payments").select("id, amount_nano").eq("tg_id", user.id).eq("pack", "mine_pass").eq("status", "pending").order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (pending.error) throw new Error(pending.error.message);
      if (pending.data) return { id: pending.data.id, address: TREASURY_ADDRESS, amount: String(pending.data.amount_nano), payload: commentPayload(paymentComment(pending.data.id)) };
    }
    const { data: row, error } = await db
      .from("wall_payments")
      .insert({ tg_id: user.id, pack: pack.id, amount_nano: Number(toNano(pack.ton)), coins: pack.coins })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return {
      id: row.id,
      address: TREASURY_ADDRESS,
      amount: toNano(pack.ton).toString(),
      payload: commentPayload(paymentComment(row.id)),
    };
  });

type TcTx = {
  hash: string;
  in_msg?: { value?: string; message_content?: { decoded?: { comment?: string } | null } };
};

/** Looks for the payment on-chain (by its comment) and credits coins once. */
export const checkTonPayment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => authInput.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { user, db } = await authPlayer(data.initData);
    const { data: p, error } = await db.from("wall_payments").select("*").eq("id", data.id).eq("tg_id", user.id).single();
    if (error || !p) throw new Error("no_payment");
    const mintedFor = async (): Promise<MintedNft | null> => {
      if (p.pack !== "nft_mint") return null;
      const n = await db.from("wall_nfts").select("serial, design, created_at").eq("payment_id", p.id).maybeSingle();
      if (n.error) throw new Error(n.error.message);
      return n.data ? { serial: Number(n.data.serial), design: n.data.design, mintedAt: n.data.created_at } : null;
    };
    if (p.status === "paid") return { coins: 0, paid: true, nft: await mintedFor(), refund: false };
    if (p.status === "refund_due") return { coins: 0, paid: true, nft: null, refund: true };

    const url = `https://toncenter.com/api/v3/transactions?account=${TREASURY_ADDRESS}&limit=100&sort=desc`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      console.error(`toncenter ${res.status}: ${await res.text()}`);
      throw new Error("not_found_yet");
    }
    const json = (await res.json()) as { transactions?: TcTx[] };
    const comment = paymentComment(p.id);
    const tx = (json.transactions ?? []).find(
      (t) => t.in_msg?.message_content?.decoded?.comment === comment && BigInt(t.in_msg?.value ?? "0") >= BigInt(p.amount_nano),
    );
    if (!tx) throw new Error("not_found_yet");
    const { data: coins, error: e2 } = await db.rpc("wall_confirm_payment", { _id: p.id, _tx: tx.hash } as never);
    if (e2) throw new Error(e2.message);
    const { notifyOwnersOfPayment } = await import("./admin-notify.server");
    await notifyOwnersOfPayment(db as never, p);
    const nft = await mintedFor();
    return { coins: Number(coins), paid: true, nft, refund: p.pack === "nft_mint" && !nft };
  });

export const claimAdReward = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    authInput.extend({ provider: z.enum(["adsgram", "monetag"]).optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { user, db } = await authPlayer(data.initData);
    const { data: amt, error } = await db.rpc("wall_ad_reward_v2" as never, {
      _tg: user.id,
      _provider: data.provider ?? "monetag",
    } as never);
    if (error) throw new Error(error.message);
    return { amount: Number(amt) };
  });
