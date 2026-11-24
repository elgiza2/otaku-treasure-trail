import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
  vi.resetModules();
});

describe("Telegram launch identity", () => {
  it("asks for bot message permission once per launch and respects denial", async () => {
    const { requestBotWriteAccess } = await import("@/lib/telegram");
    const request = vi.fn();
    vi.stubGlobal("Telegram", { WebApp: { initData: "signed-launch", version: "8.0", requestWriteAccess: request } });
    requestBotWriteAccess();
    requestBotWriteAccess();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("does not prompt players who already allowed bot messages", async () => {
    const { requestBotWriteAccess } = await import("@/lib/telegram");
    const request = vi.fn();
    vi.stubGlobal("Telegram", { WebApp: { initData: "signed-launch", version: "8.0", requestWriteAccess: request, initDataUnsafe: { user: { allows_write_to_pm: true } } } });
    requestBotWriteAccess();
    expect(request).not.toHaveBeenCalled();
  });

  it("does not request permission from browser guests or unsupported Telegram clients", async () => {
    const { requestBotWriteAccess } = await import("@/lib/telegram");
    const request = vi.fn();
    vi.stubGlobal("Telegram", { WebApp: { initData: "", version: "8.0", requestWriteAccess: request } });
    requestBotWriteAccess();
    vi.stubGlobal("Telegram", { WebApp: { initData: "signed-launch", version: "6.0", requestWriteAccess: request } });
    requestBotWriteAccess();
    expect(request).not.toHaveBeenCalled();
  });

  it("detects identity when the SDK arrives after the page mounts", async () => {
    const { useTelegramInitData } = await import("@/lib/telegram");
    vi.useFakeTimers();
    vi.stubGlobal("Telegram", undefined);
    const { result } = renderHook(useTelegramInitData);
    expect(result.current).toBe("");
    vi.stubGlobal("Telegram", { WebApp: { initData: "signed-delayed-launch" } });
    act(() => { vi.advanceTimersByTime(250); });
    expect(result.current).toBe("signed-delayed-launch");
  });

  it("preserves the signed launch fragment across in-app navigation without storage", async () => {
    const { getInitData } = await import("@/lib/telegram");
    vi.stubGlobal("Telegram", undefined);
    const payload = "query_id=launch-test&user=%7B%22id%22%3A42%7D&hash=test-signature";
    window.history.replaceState(null, "", `/#tgWebAppData=${encodeURIComponent(payload)}&tgWebAppVersion=8.0`);
    const store = vi.spyOn(Storage.prototype, "setItem");
    expect(getInitData()).toBe(payload);
    window.history.replaceState(null, "", "/tasks");
    expect(getInitData()).toBe(payload);
    expect(store).not.toHaveBeenCalled();
    store.mockRestore();
  });

  it("captures launch identity before a remembered-page redirect and retains SDK identity", async () => {
    const payload = "query_id=early-launch&hash=regression";
    vi.stubGlobal("Telegram", undefined);
    window.history.replaceState(null, "", `/#tgWebAppData=${encodeURIComponent(payload)}`);
    const { getInitData } = await import("@/lib/telegram");
    window.history.replaceState(null, "", "/wallet");
    expect(getInitData()).toBe(payload);
    vi.stubGlobal("Telegram", { WebApp: { initData: "sdk-updated-launch" } });
    expect(getInitData()).toBe("sdk-updated-launch");
    vi.stubGlobal("Telegram", undefined);
    expect(getInitData()).toBe("sdk-updated-launch");
  });

  it("prefers SDK identity and never invents identity for ordinary browser guests", async () => {
    const { getInitData } = await import("@/lib/telegram");
    vi.stubGlobal("Telegram", undefined);
    expect(getInitData()).toBe("");
    window.history.replaceState(null, "", "/#tgWebAppData=fragment-payload");
    vi.stubGlobal("Telegram", { WebApp: { initData: "sdk-payload" } });
    expect(getInitData()).toBe("sdk-payload");
  });
});