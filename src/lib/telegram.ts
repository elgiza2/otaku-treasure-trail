// Browser helpers around the Telegram Mini App SDK (window.Telegram.WebApp).
import { useEffect, useState } from "react";

type WebApp = {
  initData: string;
  initDataUnsafe?: { user?: { first_name?: string; username?: string; allows_write_to_pm?: boolean } };
  version?: string;
  requestWriteAccess?: (callback?: (allowed: boolean) => void) => void;
  ready?: () => void;
  expand?: () => void;
  openLink?: (url: string) => void;
  openTelegramLink?: (url: string) => void;
  HapticFeedback?: { notificationOccurred: (t: "success" | "error" | "warning") => void; impactOccurred: (s: string) => void };
};

export function webApp(): WebApp | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { Telegram?: { WebApp?: WebApp } }).Telegram?.WebApp ?? null;
}

let launchData = "";
export function getInitData(): string {
  if (typeof window === "undefined") return "";
  const sdkData = webApp()?.initData;
  if (sdkData) { launchData = sdkData; return sdkData; }
  // Telegram supplies the same signed payload in the launch fragment. Keep it
  // in memory only, before navigation can remove the fragment. The server
  // still verifies its signature; this is not an authentication bypass.
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  const raw = fragment.get("tgWebAppData");
  if (raw) launchData = raw;
  return launchData;
}

// Capture launch parameters before a remembered-page redirect can remove them.
if (typeof window !== "undefined") getInitData();

/** React to a delayed SDK instead of permanently snapshotting an empty session. */
export function useTelegramInitData(): string {
  const [data, setData] = useState("");
  useEffect(() => {
    const sync = () => setData(getInitData());
    sync();
    const timer = window.setInterval(sync, 250);
    const stop = window.setTimeout(() => window.clearInterval(timer), 30_000);
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(stop);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);
  return data;
}

let askedWriteAccess = false;
/** Telegram owns the consent dialog; denial never blocks play or triggers another prompt. */
export function requestBotWriteAccess(): void {
  const tg = webApp();
  if (askedWriteAccess || !getInitData() || !tg?.requestWriteAccess || parseFloat(tg.version ?? "0") < 6.9) return;
  askedWriteAccess = true;
  if (tg.initDataUnsafe?.user?.allows_write_to_pm) return;
  try { tg.requestWriteAccess(); } catch { /* Unsupported client: keep the app playable. */ }
}

export function openExternal(url: string) {
  const tg = webApp();
  if (tg?.initData) {
    if (/^https:\/\/t\.me\//.test(url) && tg.openTelegramLink) return tg.openTelegramLink(url);
    if (tg.openLink) return tg.openLink(url);
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export function shareLink(url: string, text: string) {
  openExternal(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`);
}

export function haptic(type: "success" | "error") {
  webApp()?.HapticFeedback?.notificationOccurred(type);
}

/** Display-only name from Telegram; never trusted on the server. */
export function telegramDisplayName(): string {
  const u = webApp()?.initDataUnsafe?.user;
  return u?.first_name || (u?.username ? "@" + u.username : "");
}
