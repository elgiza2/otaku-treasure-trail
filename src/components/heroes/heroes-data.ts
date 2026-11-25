import rage from "@/assets/heroes/hero-1-rage.jpg";
import mind from "@/assets/heroes/hero-2-mind.jpg";
import blade from "@/assets/heroes/hero-3-blade.jpg";
import commander from "@/assets/heroes/hero-4-commander.jpg";
import guardian from "@/assets/onboarding/v3-1-wall.jpg";

// Index = hero id in the DB (wall_hero_levels.hero).
export type Hero = { name: string; title: string; image: string; video?: string; battle?: string };
export const HEROES: Hero[] = [
  { name: "كايل", title: "الفتى الغاضب", image: rage },
  { name: "نايرا", title: "حارسة السور", image: guardian },
  { name: "آرين", title: "العقل المدبّر", image: mind },
  { name: "ليوك", title: "أقوى جندي", image: blade },
  { name: "إيفان", title: "القائد الأعلى", image: commander },
];

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX"];
export const TIER_SIZE = 10;
/** Tier index (0-based) for a 1-based level within a hero. */
export const tierOf = (level: number) => Math.floor((Math.max(1, level) - 1) / TIER_SIZE);
export const tierName = (hero: number, tier: number) => `${HEROES[hero]!.name} ${ROMAN[tier] ?? tier + 1}`;
