import { describe, expect, it } from "vitest";
import { PARTNER_POSTS_PER_DAY, PARTNER_REWARD_GRAM, withdrawalOpensAt, netRevenue, partnerSource } from "@/lib/partner-model";
describe("channel partner rules", () => {
  it("rewards a unique new user with 0.01 GRAM", () => expect(PARTNER_REWARD_GRAM).toBe(0.01));
  it("opens the first withdrawal after 30 full days from work start", () => expect(withdrawalOpensAt("2026-11-25T03:00:00Z", null)).toBe(Date.parse("2026-12-25T03:00:00Z")));
  it("opens the next withdrawal 30 full days after the last one", () => expect(withdrawalOpensAt("2026-11-25T03:00:00Z", "2026-12-25T03:00:00Z")).toBe(Date.parse("2027-01-24T03:00:00Z")));
  it("posts twice daily", () => expect(PARTNER_POSTS_PER_DAY).toBe(2));
  it("does not invent missing revenue", () => expect(netRevenue({ adsgram_revenue_usd: null, monetag_revenue_usd: 5, costs_usd: 2 })).toBeNull());
  it("computes recorded dollar income net of recorded costs", () => expect(netRevenue({ adsgram_revenue_usd: 12, monetag_revenue_usd: 8, costs_usd: 3 })).toBe(17));
  it("only recognizes a channel UUID", () => { expect(partnerSource("channel_00000000-0000-0000-0000-000000000001")).toBe("00000000-0000-0000-0000-000000000001"); expect(partnerSource("channel_bad")).toBeNull(); });
});