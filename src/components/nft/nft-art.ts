import wings from "@/assets/nft/nft-wings.jpg";
import scout from "@/assets/nft/nft-scout-flight.jpg";
import colossal from "@/assets/nft/nft-colossal.jpg";
import golden from "@/assets/nft/nft-golden-core.jpg";
import introStill from "@/assets/nft/intro-start.jpg";
import introVideo from "@/assets/nft/mikasa-nft-intro.mp4.asset.json";
import introPoster from "@/assets/nft/mikasa-nft-intro-poster.jpg.asset.json";
import type { NftRarity } from "@/lib/nft-model";

export const NFT_ART: Record<number, string> = { 1: wings, 2: scout, 3: colossal, 4: golden };
export const INTRO_STILL = introStill;
export const INTRO_POSTER = introPoster.url;
/** Intro clip with Mikasa speaking; set to null to fall back to the animated still. */
export const INTRO_VIDEO: string | null = introVideo.url;
export const INTRO_LINE_KO = "이제 전쟁의 시간이다!";

export const RARITY_TEXT: Record<NftRarity, string> = {
  common: "text-rarity-common border-rarity-common/50",
  rare: "text-rarity-rare border-rarity-rare/50",
  epic: "text-rarity-epic border-rarity-epic/50",
  legendary: "text-rarity-legendary border-rarity-legendary/60",
};
