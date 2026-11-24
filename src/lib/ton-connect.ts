import type { TonConnectUI } from "@tonconnect/ui";

// Browser-only singleton, loaded lazily so the wallet library never runs during SSR.
let instance: Promise<TonConnectUI> | null = null;

/**
 * Wallets download the manifest from their own servers, so it must live on a host
 * that needs no login. Editor previews are login-protected; map them to the project's
 * public dev host, where /api/public/* is reachable by anyone.
 */
export function publicManifestOrigin(location: { hostname: string; origin: string }): string {
  const preview = location.hostname.match(/^id-preview--([0-9a-f-]{36})\.(.+)$/);
  if (preview) return `https://project--${preview[1]}-dev.${preview[2]}`;
  const sandbox = location.hostname.match(/^([0-9a-f-]{36})\.lovableproject\.com$/);
  if (sandbox) return `https://project--${sandbox[1]}-dev.lovable.app`;
  return location.origin;
}

export function getTonConnect(): Promise<TonConnectUI> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("TON Connect is only available in the browser"));
  }
  if (!instance) {
    instance = import("@tonconnect/ui").then(({ TonConnectUI, THEME }) => {
      const ui = new TonConnectUI({
        manifestUrl: `${publicManifestOrigin(window.location)}/api/public/tonconnect-manifest`,
      });
      ui.uiOptions = { uiPreferences: { theme: THEME.DARK } };
      return ui;
    });
    instance.catch(() => {
      instance = null;
    });
  }
  return instance;
}

export async function shortTonAddress(raw: string): Promise<string> {
  const { toUserFriendlyAddress } = await import("@tonconnect/ui");
  const friendly = toUserFriendlyAddress(raw);
  return `${friendly.slice(0, 4)}…${friendly.slice(-4)}`;
}
