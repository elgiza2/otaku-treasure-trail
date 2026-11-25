import { describe, expect, it } from 'vitest';
import { BOSS_DAMAGE, BOSS_HP, BOOST_HOURS, CHEST_INTERVAL_MS, DUEL_REVENGE_REFUND, DUEL_STAKE, chestReady, dailyExtras, duelStartParam, findMicroPack, referralGrams } from '@/lib/growth-model';

describe('growth reward rules', () => {
  it('awards exactly 1 GRAM per 100 verified referrals', () => {
    expect(referralGrams(99)).toBe(0); expect(referralGrams(100)).toBe(1);
    expect(referralGrams(199)).toBe(1); expect(referralGrams(200)).toBe(2);
  });
  it('opens the mystery chest every eight hours', () => {
    const at = '2026-11-25T00:00:00Z'; const t = Date.parse(at);
    expect(CHEST_INTERVAL_MS).toBe(28_800_000);
    expect(chestReady(at, t + 28_799_999)).toBe(false);
    expect(chestReady(at, t + 28_800_000)).toBe(true);
  });
  it('gives seven escalating daily energy rewards and a day-seven spin', () => {
    expect(Array.from({ length: 7 }, (_, i) => dailyExtras(i + 1).energy)).toEqual([5,10,15,20,25,30,35]);
    expect(dailyExtras(6).spins).toBe(0); expect(dailyExtras(7).spins).toBe(1);
  });
  it('prices the five-spin pack at 0.1 TON', () => { expect(findMicroPack('micro_spins5')?.ton).toBe(0.1); });
  it('uses 24 hours for protection and loot boosts', () => { expect(BOOST_HOURS).toBe(24); });
  it('refunds half of the lost duel stake on ad revenge', () => { expect(DUEL_STAKE).toBe(20); expect(DUEL_REVENGE_REFUND).toBe(DUEL_STAKE / 2); });
  it('prices a 1000-damage boss strike at 0.05 TON', () => { expect(findMicroPack('boss_strike')?.ton).toBe(0.05); expect(BOSS_DAMAGE.paid).toBe(1000); expect(BOSS_HP).toBe(10000); });
  it('accepts only UUID duel invitation parameters', () => {
    expect(duelStartParam('start_param=duel_123')).toBeNull();
    expect(duelStartParam('start_param=duel_12345678-1234-1234-1234-123456789abc')).toBe('12345678-1234-1234-1234-123456789abc');
  });
});