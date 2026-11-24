# Roadmap

- [x] Database schema for 3-day GRAM tournament, dual ad providers, and 0.05 TON referral verification
- [x] Remove all ad limits/cooldowns from `wall_ad_reward_v2` (unlimited ads, no gap)
- [x] Add Adsgram SDK (`61733`) + Monetag dual ad support (`src/lib/adsgram.ts`, `__root.tsx`, `shop.functions.ts`, `/api/public/adsgram/reward`)
- [x] Lower ad coin reward from 100+ to 15 ANIME in DB and frontend
- [x] Add tournament model, server functions, `/tournament` route & UI, and unit tests
- [x] Wire dual Adsgram + Monetag cards on `/tasks`, tournament entry on `/tasks` & `/battle`, and GRAM balance on `/wallet`
- [x] Verify build, tests, and browser render, then commit
- [ ] Add unlimited ad wheel spins and rare GRAM prizes
- [ ] Add optional 2x battle collection through either ad network
- [ ] Add regenerating battle/raid energy and ad refills
- [ ] Add squads, invite links, weekly scoring and collective rewards
- [ ] Test and verify the requested updates