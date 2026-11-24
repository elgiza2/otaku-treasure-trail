import { describe, expect, it } from "vitest";
import { currentSlot } from "@/lib/bot-daily.server";

describe("daily bot slots", () => {
  it("sends three reminders a day at 08, 14 and 20 UTC", () => {
    expect(currentSlot(new Date("2026-11-17T09:30:00Z")).key).toBe("2026-11-17T08");
    expect(currentSlot(new Date("2026-11-17T14:00:00Z")).key).toBe("2026-11-17T14");
    expect(currentSlot(new Date("2026-11-17T23:59:00Z")).key).toBe("2026-11-17T20");
  });
  it("before 08 UTC the last slot is yesterday evening", () => {
    expect(currentSlot(new Date("2026-11-18T03:00:00Z")).key).toBe("2026-11-17T20");
  });
});
