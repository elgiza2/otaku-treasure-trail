// Bot texts in the player's Telegram language. English is the source; translations live in bot-locales.json.
import locales from "./bot-locales.json";
import { pickLang } from "@/i18n";

export const BOT_EN = {
  welcome: "Welcome, {name}.",
  calling: "Mikasa is calling you to the wall.",
  mine: "Mine $ANIME every day",
  mineSub: "your level sets your daily earnings.",
  nft: "Mint limited NFT cards",
  nftSub: "only a few copies are left.",
  story: "Play the endless anime story",
  storySub: "win, lose, and fight again.",
  listed: "$ANIME is listed on Binance.",
  tap: "Tap below and take your place.",
  open: "Open the game",
  group: "Join the group",
  community: "Community",
  binance: "$ANIME on Binance",
  gift1: "Your daily gift is here, {name}.",
  gift2: "Mikasa left you {coins} $ANIME coins.",
  gift3: "Tap the button to add them to your account — today only.",
  wall1: "The wall needs you, {name}.",
  wall2: "Your heroes have been mining.",
  wall3: "Collect your coins and push one more level.",
  night1: "Tonight's chapter is waiting, {name}.",
  night2: "Your story continues where you left it.",
  night3: "Don't lose your streak.",
  claim: "Claim {coins} coins",
  giftOk: "+{coins} coins added to your account!",
  giftDone: "You already claimed this gift.",
  giftExp: "This gift has expired. A new one comes tomorrow.",
  giftNoUser: "Open the game once first, then claim your gift.",
  oops: "Something went wrong, try again.",
} as const;
export type BotKey = keyof typeof BOT_EN;

const L = locales as Record<string, Partial<Record<BotKey, string>>>;
export function bt(lang: string | null | undefined, k: BotKey, vars: Record<string, string | number> = {}) {
  const code = pickLang(lang);
  let s: string = L[code]?.[k] ?? BOT_EN[k];
  for (const [a, b] of Object.entries(vars)) s = s.split(`{${a}}`).join(String(b));
  return s;
}
