import { beforeEach, describe, expect, it } from "vitest";
import { lastPage, rememberPage } from "@/lib/last-page";

describe("last page", () => {
  beforeEach(() => localStorage.clear());
  it("reopens on the last app page", () => {
    rememberPage("/wallet");
    expect(lastPage()).toBe("/wallet");
  });
  it("ignores the intro and admin pages", () => {
    rememberPage("/");
    rememberPage("/101");
    expect(lastPage()).toBeNull();
  });
});
