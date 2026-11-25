# Roadmap

- [x] Add TON micro packs, 24-hour protection/loot boosts and verified gold badges
- [x] Add seven-day streak, eight-hour chest and 1 GRAM per 100 verified referrals
- [x] Add story sharing, first-wallet reward and opt-in smart notifications
- [x] Add weekly squad boss and friend challenges with ad revenge
- [x] Simplify all player pages into five main tabs and contextual panels
- [x] Finish channel registration and twice-daily publishing code; activation waits for bot token
- [x] Test growth rules, translations and clean navigation; real Telegram/payment/webhook checks wait for bot token

- [x] Database schema for 3-day GRAM tournament, dual ad providers, and 0.05 TON referral verification
- [x] Remove all ad limits/cooldowns from `wall_ad_reward_v2` (unlimited ads, no gap)
- [x] Add Adsgram SDK (`61733`) + Monetag dual ad support (`src/lib/adsgram.ts`, `__root.tsx`, `shop.functions.ts`, `/api/public/adsgram/reward`)
- [x] Lower ad coin reward from 100+ to 15 ANIME in DB and frontend
- [x] Add tournament model, server functions, `/tournament` route & UI, and unit tests
- [x] Wire dual Adsgram + Monetag cards on `/tasks`, tournament entry on `/tasks` & `/battle`, and GRAM balance on `/wallet`
- [x] Verify build, tests, and browser render, then commit
- [x] Add unlimited ad wheel spins and rare 3 GRAM wheel prize
- [x] Add optional 2x battle collection through either ad network
- [x] Add regenerating battle/raid energy and ad refills
- [x] Fix new table RLS policies & FK indexes, and add 10 GRAM weekly squad league settlement
- [x] Add squads, invite links, weekly scoring and collective rewards (10 GRAM/week)
- [x] Run 153 tests, transaction-rolled-back SQL rule checks, and desktop/mobile public UI checks
- [ ] Verify real rewarded ads, signed-in squad creation, partner withdrawal and owner report UI: blocked by missing Telegram bot token and a real Telegram session
- [x] Change GRAM competition to 7-day repeating cycles; keep squads weekly
- [ ] Add channel partner onboarding, verified bot-admin registration and referral posting: blocked by rejected Telegram bot-token setup
- [x] Add 0.01 GRAM per unique new channel-referred user and owner-wide withdrawals every 30 days from work start
- [ ] Add two daily partner posts: blocked by missing bot token and external scheduler activation
- [x] Add admin channel directory, daily revenue/ad/channel/user report, CSV download and manual withdrawal review
- [x] Research relevant marketing options after checking current app and links; saved research and next steps