// Channel posts. Published automatically, one per day, by the daily scheduler endpoint.
import { ANIME_EXCHANGES } from "@/lib/anime-exchanges";

export const APP_LINK = "https://t.me/Mixsaabot?startapp";
export const GROUP_LINK = "https://t.me/micahub";
export const COMMUNITY_LINK = "https://t.me/oraien";

type Btn = { text: string; url: string; style?: "primary" | "success" | "danger"; icon_custom_emoji_id?: string };
export type ChannelPost = { day: number; image: string; caption: string; buttons: Btn[][] };

const TOP = ["Binance", "Upbit", "Bybit", "OKX", "Kraken", "Bitget", "KuCoin", "Gate", "MEXC", "HTX", "Crypto.com", "Bithumb", "Bitvavo", "WhiteBIT", "Uniswap (Ethereum)"];
const exchangeRows = (): Btn[][] => {
  const list = TOP.map((n) => ANIME_EXCHANGES.find((e) => e.name === n)).filter((e): e is NonNullable<typeof e> => !!e);
  const rows: Btn[][] = [];
  for (let i = 0; i < list.length; i += 3) rows.push(list.slice(i, i + 3).map((e) => ({ text: e.name.replace(" (Ethereum)", ""), url: e.url, icon_custom_emoji_id: "5127453140467058523" })));
  return rows;
};

export const POST_1: ChannelPost = {
  day: 1,
  image: "post-01.jpg",
  caption: [
    "<b>⚔️ MIKASA HAS ARRIVED</b>",
    "",
    "<b>The wall is open. The war begins today.</b>",
    "",
    "Mikasa is a Telegram game built around <b>$ANIME</b> — a real coin already trading on Binance, Upbit, Bybit, OKX, Kraken and 25+ more exchanges.",
    "",
    "<b>🎮 What you do:</b>",
    "• Train 5 heroes across 1,000 levels",
    "• Play a 30‑chapter anime story where your choices matter",
    "• Mine <b>$ANIME</b> every day — the higher your level, the more you earn",
    "",
    "<b>💎 Why it's different:</b>",
    "• A listed coin, not a promise",
    "• Fair, limited NFT drop — only a few copies left",
    "• Withdrawals open after 30 days of play",
    "",
    "<b>👇 Tap below and claim your place on the wall.</b>",
  ].join("\n"),
  buttons: [
    [{ text: "Play Mikasa", url: APP_LINK, style: "primary", icon_custom_emoji_id: "5046752770854487087" }],
    [{ text: "Group", url: GROUP_LINK, style: "success", icon_custom_emoji_id: "5046769637191058547" }, { text: "Community", url: COMMUNITY_LINK, style: "success", icon_custom_emoji_id: "4992560350982309130" }],
    ...exchangeRows(),
  ],
};

// Days 2–30. Each post: hook, 3 short points, call to action. Arc: launch → game depth → economy → community → scarcity.
const P = (day: number, title: string, hook: string, points: string[], cta: string): ChannelPost => ({
  day,
  image: `post-${String(day).padStart(2, "0")}.jpg`,
  caption: [`<b>${title}</b>`, "", `<b>${hook}</b>`, "", ...points.map((p) => `• ${p}`), "", `<b>👇 ${cta}</b>`].join("\n"),
  buttons: [
    [{ text: "Play Mikasa", url: APP_LINK, style: "primary", icon_custom_emoji_id: "5046752770854487087" }],
    [{ text: "Group", url: GROUP_LINK, style: "success", icon_custom_emoji_id: "5046769637191058547" }, { text: "$ANIME on Binance", url: "https://www.binance.com/en/trade/ANIME_USDT", style: "danger", icon_custom_emoji_id: "5127459531378394661" }],
  ],
});

export const POSTS: ChannelPost[] = [
  POST_1,
  P(2, "🪙 HOW YOU EARN $ANIME", "Your level is your salary.", ["Level 10 = 10 $ANIME a day", "Level 70 = 70 $ANIME a day", "Level up your heroes and your daily pay grows"], "Start leveling today"),
  P(3, "🛡 MEET YOUR FIRST HERO", "Kael — the angry boy who never quits.", ["200 levels to master", "Mines coins every hour", "Unlocks the next hero at level 200"], "Train Kael now"),
  P(4, "📖 A STORY THAT REMEMBERS YOU", "Every choice you make stays with you.", ["30 chapters, 6 parts", "Pick your path: Scout, Guardian or Shadow", "Your allies remember what you did"], "Write your chapter"),
  P(5, "💎 WHY $ANIME IS REAL", "Not a promise. A listed coin.", ["Trading on Binance, Upbit, Bybit, OKX, Kraken", "30+ exchanges worldwide", "Price you can check any second"], "See it live in the wallet"),
  P(6, "⚔️ WIN. LOSE. FIGHT AGAIN.", "Every battle is a real risk.", ["Safe moves win often but pay less", "Reckless moves pay big — if you survive", "Lose all 3 hearts and you pay the price"], "Test your nerve"),
  P(7, "🔥 WEEK ONE DONE", "The wall is getting crowded.", ["New soldiers join every hour", "Early players climb levels first", "Every day you wait is pay you miss"], "Claim your spot"),
  P(8, "🎴 THE NFT DROP", "Only 10,000 cards. Most are gone.", ["4 rarities: Common to Legendary", "Every mint is random and fair", "Fewer copies left = fewer chances"], "Check what's left"),
  P(9, "🗝 VAULT RAIDS", "Spin, raid, steal — or defend.", ["Raid other players for coins", "Shields block attacks", "Collect 3 keys to crack the vault"], "Raid the vault"),
  P(10, "🎁 DAILY GIFTS", "The bot brings you something every day.", ["Tap the button in chat", "Coins land in your account instantly", "Miss a day, miss the gift"], "Turn on bot messages"),
  P(11, "🧠 HERO TWO: NAIRA", "The guardian of the wall.", ["Mines 2× faster than Kael", "Unlocks after Kael hits 200", "The real grind starts here"], "Push to Naira"),
  P(12, "📈 HOW LEVELS WORK", "Climbing is hard. That's the point.", ["Each level costs more than the last", "Upgrades happen automatically", "Patience = a bigger daily payout"], "Keep climbing"),
  P(13, "👥 INVITE, EARN TOGETHER", "Bring your squad to the wall.", ["Share your personal link", "Friends open the game in one tap", "Invite rewards in Tasks"], "Get your link"),
  P(14, "🏆 TWO WEEKS IN", "The top players are pulling away.", ["Highest levels earn the most every day", "Your rank is visible in your profile", "There's still time to catch up"], "Climb the ranks"),
  P(15, "💸 WITHDRAWALS EXPLAINED", "Play 30 days, then cash out.", ["Minimum withdrawal: 10,000 $ANIME", "Opens 30 days after you join", "Every request is reviewed for fairness"], "Start your 30 days"),
  P(16, "🌙 CHAPTER: THE MOON NIGHT", "Mikasa has something to tell you.", ["A quiet chapter on the rooftops", "Your bond decides what she says", "The story turns here"], "Read tonight"),
  P(17, "🎟 THE MINE PASS", "One pass. One number. Yours.", ["Unlocks hero mining", "Unique serial number for every player", "Looks like a collectible card"], "Get your pass"),
  P(18, "⚡️ HERO THREE: AREN", "The mastermind.", ["4× the mining power of Kael", "Only for the patient", "Few players have reached him yet"], "Be one of them"),
  P(19, "🌍 LISTED WORLDWIDE", "$ANIME trades on every continent.", ["Korea: Upbit, Bithumb", "Global: Binance, OKX, Bybit", "Europe: Kraken, Bitvavo"], "See all exchanges"),
  P(20, "❄️ PART FOUR: WINTER", "The snow fortress waits.", ["Harder enemies, bigger rewards", "Your past choices return", "Only the trained survive"], "Enter the fortress"),
  P(21, "📅 THREE WEEKS STRONG", "Daily players are winning.", ["Check in every day for streak rewards", "5 free story plays every day", "Watch an ad for up to 3 more"], "Don't break your streak"),
  P(22, "🎴 LEGENDARY CARDS", "The rarest NFT is still out there.", ["Very few legendary copies exist", "Odds shrink as cards run out", "When it's gone, it's gone"], "Try your luck"),
  P(23, "🌊 PART FIVE: THE SEA", "Beyond the wall is the ocean.", ["The truth about the titans", "Allies may turn on you", "Every choice matters more now"], "Cross the sea"),
  P(24, "🗡 HERO FOUR: LEOK", "The strongest soldier.", ["8× the mining power of Kael", "Built for the long game", "Your daily $ANIME jumps here"], "Reach Leok"),
  P(25, "🔒 FAIR BY DESIGN", "The server decides — not your phone.", ["Battle results checked on the server", "Payments confirmed on the TON chain", "No shortcuts for anyone"], "Play fair, earn real"),
  P(26, "🔥 PART SIX: THE LAST WAR", "Everything you chose leads here.", ["The final battle of the saga", "Your path and bond decide the ending", "Then a harder cycle begins"], "Finish the war"),
  P(27, "⏳ FIRST WITHDRAWALS SOON", "Day 30 is close for early players.", ["Check your $ANIME balance", "Make sure your wallet is connected", "10,000 $ANIME minimum"], "Get ready"),
  P(28, "👑 TOP SOLDIERS", "Who rules the wall this month?", ["Highest hero levels", "Most chapters cleared", "Biggest daily earnings"], "Check your rank"),
  P(29, "🎴 LAST CALL: NFT", "The drop is almost sold out.", ["Remaining copies shown live", "One mint = one random card", "No reprints, ever"], "Mint before it ends"),
  P(30, "⚔️ ONE MONTH ON THE WALL", "This is only the beginning.", ["Withdrawals are opening", "New story cycle is live", "More heroes, more rewards ahead"], "Stay on the wall"),
];
