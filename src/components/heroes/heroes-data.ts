import rage from "@/assets/heroes/hero-1-rage.jpg";
import rageVid from "@/assets/heroes/hero-1-rage.mp4.asset.json";
import mind from "@/assets/heroes/hero-2-mind.jpg";
import blade from "@/assets/heroes/hero-3-blade.jpg";
import commander from "@/assets/heroes/hero-4-commander.jpg";
import guardian from "@/assets/onboarding/v3-1-wall.jpg";
import guardianVid from "@/assets/onboarding/story-wall.mp4.asset.json";
import mindVid from "@/assets/heroes/hero-2-mind.mp4.asset.json";
import bladeVid from "@/assets/heroes/hero-3-blade.mp4.asset.json";
import commanderVid from "@/assets/heroes/hero-4-commander.mp4.asset.json";
import b0 from "@/assets/battle/arena-1-rage.mp4.asset.json";
import b1 from "@/assets/battle/arena-2-guardian.mp4.asset.json";
import b2 from "@/assets/battle/arena-3-mind.mp4.asset.json";
import b3 from "@/assets/battle/battle-4-blade.mp4.asset.json";
import b4 from "@/assets/battle/battle-5-commander.mp4.asset.json";

// Index = hero id in the DB (wall_hero_levels.hero). Video loops muted with the still as poster.
export type Hero = { name: string; title: string; image: string; video?: string; battle?: string };
export const HEROES: Hero[] = [
  { name: "كايل", title: "الفتى الغاضب", image: rage, video: rageVid.url, battle: b0.url },
  { name: "نايرا", title: "حارسة السور", image: guardian, video: guardianVid.url, battle: b1.url },
  { name: "آرين", title: "العقل المدبّر", image: mind, video: mindVid.url, battle: b2.url },
  { name: "ليوك", title: "أقوى جندي", image: blade, video: bladeVid.url, battle: b3.url },
  { name: "إيفان", title: "القائد الأعلى", image: commander, video: commanderVid.url, battle: b4.url },
];

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX"];
export const TIER_SIZE = 10;
/** Tier index (0-based) for a 1-based level within a hero. */
export const tierOf = (level: number) => Math.floor((Math.max(1, level) - 1) / TIER_SIZE);
export const tierName = (hero: number, tier: number) => `${HEROES[hero]!.name} ${ROMAN[tier] ?? tier + 1}`;
