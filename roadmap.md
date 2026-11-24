# Roadmap

- [x] Database schema for 3-day GRAM tournament, dual ad providers, and 0.05 TON referral verification
- [ ] Remove all ad limits/cooldowns from `wall_ad_reward_v2` (unlimited ads, no gap)
- [ ] Add Adsgram SDK (`61733`) + Monetag dual ad support (`src/lib/adsgram.ts`, `__root.tsx`, `shop.functions.ts`, `/api/public/adsgram/reward`)
- [ ] Add tournament model, server functions, `/tournament` route & UI, and unit tests
- [ ] Wire dual Adsgram + Monetag cards on `/tasks`, tournament entry on `/tasks` & `/battle`, and GRAM balance on `/wallet`
- [ ] Verify build, tests, and browser render, then commit