export const TOURNAMENT_DURATION_DAYS = 7;
export const TOURNAMENT_PRIZE_POOL = 350;
export const TOURNAMENT_AD_POINTS = 10;
export const TOURNAMENT_REFERRAL_POINTS = 100;
export const TOURNAMENT_VERIFY_TON = 0.05;
export const TOURNAMENT_WINNERS_COUNT = 20;

export type AdProvider = "adsgram" | "monetag";

export const TOURNAMENT_PRIZE_TIERS = [
  { label: "المركز 1", from: 1, to: 1, gram: 120 },
  { label: "المركز 2", from: 2, to: 2, gram: 70 },
  { label: "المركز 3", from: 3, to: 3, gram: 40 },
  { label: "المراكز 4 – 10", from: 4, to: 10, gram: 10 },
  { label: "المراكز 11 – 20", from: 11, to: 20, gram: 5 },
] as const;

/** GRAM prize awarded for a given 1-based leaderboard rank (mirrors SQL wall_tournament_prize). */
export function prizeForRank(rank: number): number {
  if (!Number.isInteger(rank) || rank < 1) return 0;
  if (rank === 1) return 120;
  if (rank === 2) return 70;
  if (rank === 3) return 40;
  if (rank <= 10) return 10;
  if (rank <= 20) return 5;
  return 0;
}

/** Formats remaining tournament time in Arabic (e.g. "2ي 14س 05د 12ث"). */
export function formatCountdown(endsAtMs: number, nowMs: number): string {
  const diff = Math.max(0, Math.floor((endsAtMs - nowMs) / 1000));
  const d = Math.floor(diff / 86_400);
  const h = Math.floor((diff % 86_400) / 3_600);
  const m = Math.floor((diff % 3_600) / 60);
  const s = diff % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (d > 0) return `${d}ي ${pad(h)}س ${pad(m)}د`;
  return `${pad(h)}س ${pad(m)}د ${pad(s)}ث`;
}

export type TournamentLeaderDTO = {
  rank: number;
  tgId: number;
  name: string;
  username: string | null;
  photoUrl: string | null;
  points: number;
  adsCount: number;
  referralsCount: number;
  prizeGram: number;
  verified?: boolean;
};

export type TournamentRoundDTO = {
  id: string;
  roundNumber: number;
  startsAt: string;
  endsAt: string;
  prizePool: number;
};

export type PastRoundDTO = {
  id: string;
  roundNumber: number;
  endedAt: string;
  prizePool: number;
  winners: TournamentLeaderDTO[];
};

export type TournamentBoardDTO = {
  round: TournamentRoundDTO;
  leaders: TournamentLeaderDTO[];
  participantsCount: number;
  pastRounds: PastRoundDTO[];
};

export type MyTournamentStatusDTO = {
  tgId: number;
  gramBalance: number;
  isVerified: boolean;
  points: number;
  adsCount: number;
  referralsCount: number;
  rank: number | null;
  projectedPrize: number;
};