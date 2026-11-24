// Vault Raid rules. Mirrored by wall_raid_load / wall_raid_spin / wall_confirm_payment in the DB — change both together.
export const MAX_FREE_SPINS = 5;
export const SPIN_REGEN_HOURS = 1;
export const VAULT_KEYS = 3;
export const VAULT_SHARE = 0.1;
export const RAID_STEAL_SHARE = 0.1;
export const RAID_STEAL_CAP = 500;

export type SpinPackId = "spins_20" | "spins_60" | "spins_250";
export const SPIN_PACKS: { id: SpinPackId; ton: number; spins: number; tag?: string }[] = [
  { id: "spins_20", ton: 0.5, spins: 20 },
  { id: "spins_60", ton: 1, spins: 60, tag: "الأكثر طلبًا" },
  { id: "spins_250", ton: 3, spins: 250, tag: "أوفر" },
];
export function findSpinPack(id: string) {
  return SPIN_PACKS.find((p) => p.id === id);
}

export type Segment = "coins" | "jackpot_coins" | "shield" | "raid" | "key" | "vault";
export const WHEEL: { seg: Exclude<Segment, "vault">; label: string }[] = [
  { seg: "coins", label: "10" },
  { seg: "raid", label: "غارة" },
  { seg: "key", label: "مفتاح" },
  { seg: "shield", label: "درع" },
  { seg: "jackpot_coins", label: "50" },
  { seg: "raid", label: "غارة" },
  { seg: "key", label: "مفتاح" },
  { seg: "coins", label: "10" },
];

/** Free spins regained since `at`: +1 per hour, never above the free cap. Paid spins above the cap are kept. */
export function regenSpins(spins: number, at: Date, now: Date): number {
  if (spins >= MAX_FREE_SPINS) return spins;
  const hours = Math.floor((now.getTime() - at.getTime()) / 3_600_000 / SPIN_REGEN_HOURS);
  return Math.min(MAX_FREE_SPINS, spins + Math.max(0, hours));
}

/** Coins a raid takes from an unshielded target. */
export function raidSteal(balance: number): number {
  return Math.min(Math.round(balance * RAID_STEAL_SHARE), RAID_STEAL_CAP);
}

export type RaidLog = { id: number; attacker: string; amount: number; blocked: boolean; avenged: boolean; at: string };
export type RaidState = { spins: number; spinsAt: string; shields: number; keys: number; pot: number; lastWin: number | null; attacks: RaidLog[]; pendingId: string | null };
export type SpinResult = { segment: Segment; amount: number; blocked: boolean };
