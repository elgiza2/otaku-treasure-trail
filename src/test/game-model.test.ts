import { describe, it, expect } from "vitest";
import { doubleLoot, energyNow, ENERGY_COST, ENERGY_MAX, SQUAD_PRIZE_POOL, SQUAD_PRIZES, WHEEL_GRAM_PRIZE, squadStartParam } from "@/lib/game-model";
describe("game reward rules", () => {
  it("awards 3 GRAM for the rare wheel result", () => expect(WHEEL_GRAM_PRIZE).toBe(3));
  it("allocates 10 GRAM total to squads", () => { expect(SQUAD_PRIZE_POOL).toBe(10); expect(SQUAD_PRIZES.reduce((a, b) => a + b, 0)).toBe(10); });
  it("doubles battle loot", () => expect(doubleLoot(43.5)).toBe(87));
  it("regenerates one energy each two minutes", () => expect(energyNow({ energy: 20, regeneratedAt: "2026-11-25T00:00:00Z" }, Date.parse("2026-11-25T00:06:00Z"))).toBe(23));
  it("caps energy at 100", () => { expect(ENERGY_MAX).toBe(100); expect(energyNow({ energy: 99, regeneratedAt: "2026-11-25T00:00:00Z" }, Date.parse("2026-11-25T00:06:00Z"))).toBe(100); });
  it("costs 20 energy per raid or battle collection", () => expect(ENERGY_COST).toBe(20));
  it("recognizes a squad invite only with a valid ID", () => { expect(squadStartParam("start_param=squad_123")).toBeNull(); expect(squadStartParam("start_param=squad_00000000-0000-0000-0000-000000000001")).toBe("00000000-0000-0000-0000-000000000001"); });
});