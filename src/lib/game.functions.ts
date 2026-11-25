import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authPlayer } from "./tasks.functions";
import type { EnergyState, SquadBoard } from "./game-model";

const auth = z.object({ initData: z.string().min(10).max(4096) });
export const getEnergy = createServerFn({ method: "POST" }).inputValidator((d: unknown) => auth.parse(d)).handler(async ({ data }): Promise<EnergyState> => {
  const { user, db } = await authPlayer(data.initData);
  const r = await db.rpc("wall_energy_load", { _tg: user.id });
  if (r.error) throw new Error(r.error.message);
  return { energy: r.data.energy, regeneratedAt: r.data.regenerated_at };
});
export const claimGameAd = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => auth.extend({ provider: z.enum(["adsgram", "monetag"]), benefit: z.enum(["spin", "energy", "double"]), requestId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { user, db } = await authPlayer(data.initData);
    const r = await db.rpc("wall_game_ad", { _tg: user.id, _provider: data.provider, _benefit: data.benefit, _request: data.requestId });
    if (r.error) throw new Error(r.error.message);
    return r.data as { amount: number; adReward: number; benefit: string };
  });
export const getSquadBoard = createServerFn({ method: "GET" }).handler(async (): Promise<SquadBoard> => {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const url = process.env["SUPABASE_URL"];
  if (!key || !url) throw new Error("not_configured");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => {
    const headers = new Headers(init?.headers);
    if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  } } });
  const r = await db.rpc("wall_squad_board");
  if (r.error) throw new Error(r.error.message);
  return r.data as SquadBoard;
});
export const getMySquad = createServerFn({ method: "POST" }).inputValidator((d: unknown) => auth.parse(d)).handler(async ({ data }) => {
  const { user, db } = await authPlayer(data.initData);
  const settled = await db.rpc("wall_settle_squad_weeks");
  if (settled.error) throw new Error(settled.error.message);
  const r = await db.from("wall_squad_members").select("squad_id").eq("tg_id", user.id).maybeSingle();
  if (r.error) throw new Error(r.error.message);
  const squadId=r.data?.squad_id ?? null;
  if(!squadId) return { squadId, members: [] as {name:string;verified:boolean}[] };
  const membership=await db.from('wall_squad_members').select('tg_id').eq('squad_id',squadId).limit(100);
  if(membership.error)throw new Error(membership.error.message);
  const ids=membership.data.map(m=>m.tg_id);
  if(ids.length===0)return {squadId,members:[] as {name:string;verified:boolean}[]};
  const [users,passes]=await Promise.all([db.from('wall_users').select('tg_id,first_name').in('tg_id',ids),db.from('wall_mine_passes').select('tg_id').in('tg_id',ids)]);
  if(users.error||passes.error)throw new Error('load_failed');
  const verified=new Set(passes.data.map(p=>p.tg_id));
  return { squadId, members: users.data.map(u=>({name:u.first_name,verified:verified.has(u.tg_id)})) };
});
export const manageSquad = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => auth.extend({ action: z.enum(["create", "join", "leave"]), squadId: z.string().uuid().optional(), name: z.string().trim().min(3).max(32).optional(), emblem: z.enum(["⚔️", "🛡️", "🔥", "🐉"]).optional() }).parse(d))
  .handler(async ({ data }) => {
    const { user, db } = await authPlayer(data.initData);
    const settled = await db.rpc("wall_settle_squad_weeks");
    if (settled.error) throw new Error(settled.error.message);
    const r = await db.rpc("wall_squad_manage", { _tg: user.id, _action: data.action, ...(data.squadId ? { _squad: data.squadId } : {}), ...(data.name ? { _name: data.name } : {}), _emblem: data.emblem ?? "⚔️" });
    if (r.error) throw new Error(r.error.message);
    return { squadId: r.data };
  });