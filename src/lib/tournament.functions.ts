import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { authPlayer } from "./tasks.functions";
import {
  prizeForRank,
  TOURNAMENT_WINNERS_COUNT,
  type MyTournamentStatusDTO,
  type PastRoundDTO,
  type TournamentBoardDTO,
  type TournamentLeaderDTO,
} from "./tournament-model";

const authInput = z.object({ initData: z.string().min(10).max(4096) });

type EntryRow = {
  tg_id: number;
  points: number;
  ads_count: number;
  referrals_count: number;
  prize_gram: number;
  final_rank: number | null;
};

type UserLite = {
  tg_id: number;
  first_name: string;
  username: string | null;
  photo_url: string | null;
};

function mapLeaders(entries: EntryRow[], usersById: Map<number, UserLite>, settled: boolean): TournamentLeaderDTO[] {
  return entries.map((e, idx) => {
    const rank = settled && e.final_rank ? e.final_rank : idx + 1;
    const u = usersById.get(Number(e.tg_id));
    return {
      rank,
      tgId: Number(e.tg_id),
      name: u?.first_name || u?.username || `لاعب #${String(e.tg_id).slice(-4)}`,
      username: u?.username ?? null,
      photoUrl: u?.photo_url ?? null,
      points: Number(e.points),
      adsCount: Number(e.ads_count),
      referralsCount: Number(e.referrals_count),
      prizeGram: settled ? Number(e.prize_gram) : prizeForRank(rank),
    };
  });
}

/** Public leaderboard & active 3-day round (automatically settles expired rounds). */
export const getTournamentBoard = createServerFn({ method: "GET" }).handler(async (): Promise<TournamentBoardDTO> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin;
  const { data: activeId, error: e0 } = await db.rpc("wall_ensure_active_tournament" as never);
  if (e0) throw new Error(e0.message);

  const tid = String(activeId);
  const [roundRes, entriesRes, countRes, pastRes] = await Promise.all([
    db.from("wall_tournaments" as never).select("id, round_number, starts_at, ends_at, prize_pool").eq("id", tid).single(),
    db
      .from("wall_tournament_entries" as never)
      .select("tg_id, points, ads_count, referrals_count, prize_gram, final_rank")
      .eq("tournament_id", tid)
      .gt("points", 0)
      .order("points", { ascending: false })
      .order("updated_at", { ascending: true })
      .limit(TOURNAMENT_WINNERS_COUNT),
    db.from("wall_tournament_entries" as never).select("tg_id", { count: "exact", head: true }).eq("tournament_id", tid).gt("points", 0),
    db
      .from("wall_tournaments" as never)
      .select("id, round_number, ends_at, prize_pool")
      .eq("status", "settled")
      .order("round_number", { ascending: false })
      .limit(3),
  ]);

  if (roundRes.error) throw new Error(roundRes.error.message);
  if (entriesRes.error) throw new Error(entriesRes.error.message);
  if (pastRes.error) throw new Error(pastRes.error.message);

  const activeEntries = (entriesRes.data ?? []) as EntryRow[];
  const pastRows = (pastRes.data ?? []) as { id: string; round_number: number; ends_at: string; prize_pool: number }[];

  let pastEntriesByRound = new Map<string, EntryRow[]>();
  if (pastRows.length > 0) {
    const pastIds = pastRows.map((r) => r.id);
    const { data: pe } = await db
      .from("wall_tournament_entries" as never)
      .select("tournament_id, tg_id, points, ads_count, referrals_count, prize_gram, final_rank")
      .in("tournament_id", pastIds)
      .lte("final_rank", 3)
      .order("final_rank", { ascending: true });
    for (const row of (pe ?? []) as (EntryRow & { tournament_id: string })[]) {
      const list = pastEntriesByRound.get(row.tournament_id) ?? [];
      list.push(row);
      pastEntriesByRound.set(row.tournament_id, list);
    }
  }

  const allTgIds = new Set<number>();
  for (const e of activeEntries) allTgIds.add(Number(e.tg_id));
  for (const list of pastEntriesByRound.values()) for (const e of list) allTgIds.add(Number(e.tg_id));

  const usersById = new Map<number, UserLite>();
  if (allTgIds.size > 0) {
    const { data: users } = await db
      .from("wall_users")
      .select("tg_id, first_name, username, photo_url")
      .in("tg_id", [...allTgIds]);
    for (const u of (users ?? []) as UserLite[]) usersById.set(Number(u.tg_id), u);
  }

  const r = roundRes.data as { id: string; round_number: number; starts_at: string; ends_at: string; prize_pool: number };
  const pastRounds: PastRoundDTO[] = pastRows.map((pr) => ({
    id: pr.id,
    roundNumber: Number(pr.round_number),
    endedAt: pr.ends_at,
    prizePool: Number(pr.prize_pool),
    winners: mapLeaders(pastEntriesByRound.get(pr.id) ?? [], usersById, true),
  }));

  return {
    round: {
      id: r.id,
      roundNumber: Number(r.round_number),
      startsAt: r.starts_at,
      endsAt: r.ends_at,
      prizePool: Number(r.prize_pool),
    },
    leaders: mapLeaders(activeEntries, usersById, false),
    participantsCount: countRes.count ?? 0,
    pastRounds,
  };
});

/** Authenticated player status in the current 3-day tournament + GRAM balance + 0.05 TON verification state. */
export const getMyTournamentStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => authInput.parse(d))
  .handler(async ({ data }): Promise<MyTournamentStatusDTO> => {
    const { user, db } = await authPlayer(data.initData);
    const { data: activeId, error: e0 } = await db.rpc("wall_ensure_active_tournament" as never);
    if (e0) throw new Error(e0.message);
    const tid = String(activeId);

    const [uRes, passRes, entryRes] = await Promise.all([
      db.from("wall_users").select("gram_balance").eq("tg_id", user.id).single(),
      db.from("wall_mine_passes").select("pass_number").eq("tg_id", user.id).maybeSingle(),
      db
        .from("wall_tournament_entries" as never)
        .select("points, ads_count, referrals_count, updated_at")
        .eq("tournament_id", tid)
        .eq("tg_id", user.id)
        .maybeSingle(),
    ]);
    if (uRes.error) throw new Error(uRes.error.message);

    const entry = entryRes.data as { points: number; ads_count: number; referrals_count: number; updated_at: string } | null;
    const points = entry ? Number(entry.points) : 0;
    let rank: number | null = null;
    if (points > 0) {
      const { count } = await db
        .from("wall_tournament_entries" as never)
        .select("tg_id", { count: "exact", head: true })
        .eq("tournament_id", tid)
        .gt("points", points);
      rank = (count ?? 0) + 1;
    }

    return {
      tgId: user.id,
      gramBalance: Number((uRes.data as { gram_balance?: number } | null)?.gram_balance ?? 0),
      isVerified: !!passRes.data,
      points,
      adsCount: entry ? Number(entry.ads_count) : 0,
      referralsCount: entry ? Number(entry.referrals_count) : 0,
      rank,
      projectedPrize: rank ? prizeForRank(rank) : 0,
    };
  });