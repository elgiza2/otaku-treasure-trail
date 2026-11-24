// Animated custom emoji from Telegram's "The Open Emoji" pack (@creatonart), stored as Lottie JSON.
import blocks from "@/assets/emoji/blocks.json.asset.json";
import crystal from "@/assets/emoji/crystal.json.asset.json";
import gem from "@/assets/emoji/gem.json.asset.json";
import globe from "@/assets/emoji/globe.json.asset.json";
import orbit from "@/assets/emoji/orbit.json.asset.json";
import ore from "@/assets/emoji/ore.json.asset.json";
import rays from "@/assets/emoji/rays.json.asset.json";
import rocket from "@/assets/emoji/rocket.json.asset.json";
import scout from "@/assets/emoji/scout.json.asset.json";
import shields from "@/assets/emoji/shields.json.asset.json";
import spark from "@/assets/emoji/spark.json.asset.json";
import sparkle from "@/assets/emoji/sparkle.json.asset.json";
import ton from "@/assets/emoji/ton.json.asset.json";
import verified from "@/assets/emoji/verified.json.asset.json";
import wallet from "@/assets/emoji/wallet.json.asset.json";

export const EMOJI = {
  blocks: blocks.url,
  crystal: crystal.url,
  gem: gem.url,
  globe: globe.url,
  orbit: orbit.url,
  ore: ore.url,
  rays: rays.url,
  rocket: rocket.url,
  scout: scout.url,
  shields: shields.url,
  spark: spark.url,
  sparkle: sparkle.url,
  ton: ton.url,
  verified: verified.url,
  wallet: wallet.url,
} as const;

export type EmojiName = keyof typeof EMOJI;

export function emojiName(name: string): EmojiName {
  return name in EMOJI ? (name as EmojiName) : "sparkle";
}
