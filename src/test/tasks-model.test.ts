import { describe, expect, it } from "vitest";

import { checkinReward, checkinState, taskState, type PlayerDTO, type TaskDTO } from "@/lib/tasks-model";
import { publicManifestOrigin } from "@/lib/ton-connect";

const H = 3_600_000;
const NOW = Date.UTC(2026, 10, 17, 12);
const iso = (ms: number) => new Date(ms).toISOString();

const task = (over: Partial<TaskDTO> = {}): TaskDTO => ({
  id: "t1", category: "social", kind: "telegram", title: "x", url: "https://t.me/x",
  reward: 5, cooldownHours: null, required: 1, emoji: "scout", sort: 0, ...over,
});
const player = (over: Partial<PlayerDTO> = {}): PlayerDTO => ({
  tgId: 1, firstName: "a", balance: 0, wallet: null, streak: 0, lastCheckinAt: null, referrals: 0, weekEarned: 0, ...over,
});

describe("daily check-in", () => {
  it("pays 5 on day 1 and 11 on day 7", () => {
    expect(checkinReward(1)).toBe(5);
    expect(checkinReward(7)).toBe(11);
  });
  it("allows one claim per UTC day", () => {
    const s = checkinState(3, iso(NOW - H), NOW);
    expect(s.claimable).toBe(false);
    expect(s.nextAt).toBe(Date.UTC(2026, 10, 18));
    expect(checkinState(3, iso(Date.UTC(2026, 10, 16, 23, 59)), Date.UTC(2026, 10, 17)).claimable).toBe(true);
  });
  it("continues the streak after 24 hours", () => {
    const s = checkinState(3, iso(NOW - 25 * H), NOW);
    expect(s).toMatchObject({ claimable: true, nextDay: 4 });
  });
  it("restarts at day 1 after missing more than 48 hours", () => {
    expect(checkinState(5, iso(NOW - 49 * H), NOW)).toMatchObject({ claimable: true, nextDay: 1, doneDays: 0 });
  });
  it("starts a new week after day 7", () => {
    expect(checkinState(7, iso(NOW - 25 * H), NOW)).toMatchObject({ nextDay: 1, doneDays: 0 });
  });
});

describe("task states", () => {
  it("one-time task is done after claiming", () => {
    expect(taskState(task(), { taskId: "t1", startedAt: null, lastClaimedAt: iso(NOW - 100 * H) }, player(), NOW).type).toBe("done");
  });
  it("repeatable task reopens after its cooldown", () => {
    const t = task({ cooldownHours: 24 });
    expect(taskState(t, { taskId: "t1", startedAt: null, lastClaimedAt: iso(NOW - 23 * H) }, player(), NOW).type).toBe("cooldown");
    expect(taskState(t, { taskId: "t1", startedAt: null, lastClaimedAt: iso(NOW - 25 * H) }, player(), NOW).type).toBe("go");
  });
  it("invite task needs the required number of friends", () => {
    const t = task({ kind: "referral", required: 5 });
    expect(taskState(t, undefined, player({ referrals: 4 }), NOW)).toEqual({ type: "progress", have: 4, need: 5 });
    expect(taskState(t, undefined, player({ referrals: 5 }), NOW).type).toBe("ready");
  });
  it("started link task asks to verify", () => {
    expect(taskState(task(), { taskId: "t1", startedAt: iso(NOW), lastClaimedAt: null }, player(), NOW).type).toBe("verify");
  });
});

describe("wallet manifest host", () => {
  const id = "a2471337-c721-4e08-82b4-bbf15e7801cf";
  it("maps login-protected previews to the public dev host", () => {
    expect(publicManifestOrigin({ hostname: `id-preview--${id}.lovable.app`, origin: "" })).toBe(`https://project--${id}-dev.lovable.app`);
    expect(publicManifestOrigin({ hostname: `${id}.lovableproject.com`, origin: "" })).toBe(`https://project--${id}-dev.lovable.app`);
  });
  it("keeps published domains as they are", () => {
    expect(publicManifestOrigin({ hostname: "game.example.com", origin: "https://game.example.com" })).toBe("https://game.example.com");
  });
});
