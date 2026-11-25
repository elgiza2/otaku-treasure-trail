import { BOT_USERNAME } from './coin';

export const CHEST_INTERVAL_MS = 8 * 3_600_000;
export const REFERRALS_PER_GRAM = 100;
export const BOOST_HOURS = 24;
export const DUEL_STAKE = 20;
export const DUEL_REVENGE_REFUND = 10;
export const BOSS_HP = 10_000;
export const BOSS_DAMAGE = { normal: 100, ad: 500, paid: 1000 } as const;
export const MICRO_PACKS = [
  { id: 'micro_energy', label: 'طاقة كاملة', detail: '100 طاقة فوراً', ton: 0.1, icon: 'energy' },
  { id: 'micro_spins5', label: '5 لفات', detail: 'بدون إعلانات', ton: 0.1, icon: 'spins' },
  { id: 'micro_shield', label: 'درع الحماية', detail: 'حماية من الغارات لمدة 24 ساعة', ton: 0.1, icon: 'shield' },
  { id: 'micro_boost', label: 'مضاعف الغنائم', detail: 'تعدين 2x لمدة 24 ساعة', ton: 0.1, icon: 'boost' },
  { id: 'boss_strike', label: 'ضربة الزعيم', detail: '1,000 ضرر · تذكرة ضربة واحدة', ton: 0.05, icon: 'boss' },
] as const;
export function findMicroPack(id: string) { return MICRO_PACKS.find(p => p.id === id); }
export function referralGrams(count: number) { return Math.floor(Math.max(0, count) / REFERRALS_PER_GRAM); }
export function chestReady(at: string | null, now: number) { return !at || now >= Date.parse(at) + CHEST_INTERVAL_MS; }
export function dailyExtras(day: number) { return { energy: day * 5, spins: day === 7 ? 1 : 0 }; }
export function duelLink(id: string) { return `https://t.me/${BOT_USERNAME}?startapp=duel_${id}&mode=fullscreen`; }
export function duelStartParam(initData: string) {
  const v = new URLSearchParams(initData).get('start_param') ?? '';
  const id = v.startsWith('duel_') ? v.slice(5) : '';
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : null;
}
export type GrowthAction = 'daily' | 'chest' | 'chest_ad' | 'referrals' | 'notify_on' | 'notify_off' | 'duel_create' | 'duel_accept' | 'duel_cancel' | 'duel_revenge' | 'boss' | 'boss_ad' | 'boss_paid';
export type Duel = { id: string; mine: boolean; status: 'pending' | 'settled' | 'cancelled'; won: boolean | null; avenged: boolean; expiresAt: string; name: string | null };
export type GrowthState = {
  tgId: number; name: string; balance: number; gram: number; verified: boolean; streak: number;
  lastCheckinAt: string | null; chestAt: string | null; referrals: number; milestones: number;
  boostUntil: string | null; protectionUntil: string | null; bossStrikes: number; notifications: boolean;
  squadId: string | null; bossHp: number; bossEndsAt: string; duels: Duel[];
  invite: { id: string; name: string; status: string; expiresAt: string; mine: boolean } | null;
};
export type GrowthResult = { id?: string; amount?: number; reward?: number; energy?: number; spins?: number; gram?: number; damage?: number; hp?: number; won?: boolean; ok?: boolean };
export function growthError(e: unknown) {
  const m = e instanceof Error ? e.message : '';
  const errors: Record<string, string> = { too_early: 'استلمت مكافأة اليوم، ارجع بكرة', chest_wait: 'الصندوق لسه مش جاهز', insufficient_coins: 'محتاج 20 ANIME للتحدي', no_energy: 'اشحن طاقتك الأول', no_squad: 'انضم لتحالف الأول', boss_defeated: 'الزعيم اتهزم، استنى الأسبوع الجديد', no_strikes: 'اشتري تذكرة ضربة الأول', duel_unavailable: 'التحدي انتهى أو اتلعب بالفعل', no_revenge: 'استلمت تعويض التحدي بالفعل', not_configured: 'اللعب والمكافآت متاحين بعد تفعيل البوت' };
  return Object.entries(errors).find(([key]) => m.includes(key))?.[1] ?? 'ما قدرناش نكمل، جرّب تاني';
}