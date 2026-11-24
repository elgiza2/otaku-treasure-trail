// Endless anime campaign. Rules are mirrored by wall_novel_play / wall_novel_ad / wall_confirm_payment — change both together.
export const BLADE_ITEM = "story_blade";
export const FREE_PLAYS = 5;
export const AD_PLAYS_MAX = 3;
export const STEPS_PER_CHAPTER = 3;
export const MAX_HEARTS = 3;
export const PLAYS_PACK = { id: "novel_plays_5", ton: 0.3, plays: 5 } as const;

export type Risk = "safe" | "bold" | "reckless" | "blade";
export const RISKS: Record<Risk, { chance: number; mult: number }> = {
  safe: { chance: 80, mult: 0.5 }, bold: { chance: 55, mult: 1 }, reckless: { chance: 30, mult: 2.5 }, blade: { chance: 100, mult: 3 },
};

/** Win chance (%) for a risk at a chapter: harder by 1% per chapter, capped at -15. Blade always wins. */
export function winChance(risk: Risk, chapter: number) {
  return risk === "blade" ? 100 : RISKS[risk].chance - Math.min(15, chapter - 1);
}
/** Coins for winning a step; the boss (last step) pays double. */
export function stepReward(risk: Risk, chapter: number, step: number) {
  const base = (2 + Math.floor((chapter - 1) / 4)) * (step >= STEPS_PER_CHAPTER ? 2 : 1);
  return Math.floor(base * RISKS[risk].mult);
}
/** Coins lost when the last heart breaks (chapter restarts from step 1). */
export function knockoutPenalty(chapter: number, balance: number) {
  return Math.min(Math.max(balance, 0), chapter);
}
/** Plays left today: free + watched ads − used, plus bought plays (never expire). */
export function playsLeft(p: { playsUsed: number; adsUsed: number; bonus: number }) {
  return Math.max(0, FREE_PLAYS + p.adsUsed - p.playsUsed) + p.bonus;
}

export type Art = "dawn" | "forest" | "tunnel" | "vault";
type Arc = { title: string; art: Art; place: string; foe: string; ally: string; moves: [string, string, string] };
export const ARCS: Arc[] = [
  { title: "البوابة الجنوبية", art: "dawn", place: "البوابة الجنوبية", foe: "عملاق الضباب", ally: "ميكاسا", moves: ["أحمي الناس وأتراجع", "أهجم على رجله", "أقفز على رقبته"] },
  { title: "غابة الأشجار العملاقة", art: "forest", place: "الغابة", foe: "العملاق الأنثى", ally: "ليفاي", moves: ["أستخبى بين الشجر", "أشد الحبال وألف حواليه", "أهجم من فوق"] },
  { title: "أنفاق تحت المدينة", art: "tunnel", place: "الأنفاق", foe: "الصياد الأعمى", ally: "أرمين", moves: ["أمشي بهدوء جنب الحيطة", "أرمي قنبلة دخان", "أجري في الضلمة"] },
  { title: "خزنة الملوك", art: "vault", place: "الخزنة القديمة", foe: "الحارس الحجري", ally: "هانجي", moves: ["أفك الفخ بحذر", "أكسر القفل", "أفتح البوابة بالقوة"] },
  { title: "ليلة الدم", art: "forest", place: "المعسكر", foe: "الخائن المقنّع", ally: "جان", moves: ["أراقبه من بعيد", "أواجهه بالكلام", "أشيل القناع بالقوة"] },
  { title: "السور الأخير", art: "dawn", place: "أعلى السور", foe: "العملاق المدرّع", ally: "راينر", moves: ["أدافع عن المدفع", "أضرب مفاصله", "أنط من السور عليه"] },
];
const OPEN = ["الهوا ساقع والصمت مخيف في", "صوت خطوات تقيلة بيقرب من", "دخان أسود طالع من", "جرس الإنذار بيضرب في"];
const ALLY = ["خلي بالك، ده أقوى من اللي قبله!", "مش هنرجع غير لما نخلص عليه.", "لو وقعت هشيلك، بس متتهورش.", "فيه حاجة غريبة… كأنه مستنينا."];

export type Encounter = { arc: Arc; season: number; title: string; lines: { who: string; text: string }[]; boss: boolean };

/** Deterministic, endless content: chapter N cycles arcs and raises the season. */
export function encounter(chapter: number, step: number): Encounter {
  const i = (chapter - 1) % ARCS.length;
  const arc = ARCS[i]!;
  const season = Math.floor((chapter - 1) / ARCS.length) + 1;
  const boss = step >= STEPS_PER_CHAPTER;
  const k = chapter * 7 + step * 3;
  const foe = boss ? `${arc.foe} (الزعيم)` : step === 1 ? `كشافة ${arc.foe}` : `حرس ${arc.foe}`;
  return {
    arc, season, boss,
    title: `الموسم ${season} · فصل ${chapter} — ${arc.title}`,
    lines: [
      { who: "الراوي", text: `${OPEN[k % OPEN.length]} ${arc.place}. قدامك ${foe}.` },
      { who: arc.ally, text: ALLY[(k + season) % ALLY.length]! },
    ],
  };
}
