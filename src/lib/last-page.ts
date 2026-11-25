// Remembers the last app page so reopening the mini app returns there, not to the intro.
// Saved both locally and in Telegram CloudStorage, because some Telegram apps wipe local storage between opens.
const KEY = "wall_last_page";
const PAGES = ["/tasks", "/battle", "/heroes", "/raid", "/wallet", "/profile", "/squads", "/duels", "/store", "/partners", "/tournament"];

type Cloud = { setItem(k: string, v: string): void; getItem(k: string, cb: (e: unknown, v?: string) => void): void };
const cloud = (): Cloud | undefined => {
  const w = globalThis as unknown as { Telegram?: { WebApp?: { CloudStorage?: Cloud; version?: string } } };
  const wa = w.Telegram?.WebApp;
  return wa && parseFloat(wa.version ?? "0") >= 6.9 ? wa.CloudStorage : undefined;
};

export function rememberPage(path: string) {
  if (!PAGES.includes(path)) return;
  try { localStorage.setItem(KEY, path); } catch { /* private mode */ }
  try { cloud()?.setItem(KEY, path); } catch { /* old client */ }
}

export function lastPage(): string | null {
  try {
    const p = localStorage.getItem(KEY) ?? localStorage.getItem("wall:last-page");
    return p && PAGES.includes(p) ? p : null;
  } catch { return null; }
}

export function lastPageAsync(): Promise<string | null> {
  const local = lastPage();
  const c = cloud();
  if (local || !c) return Promise.resolve(local);
  return new Promise((res) => {
    const t = setTimeout(() => res(null), 1500);
    try {
      c.getItem(KEY, (_e, v) => { clearTimeout(t); res(v && PAGES.includes(v) ? v : null); });
    } catch { clearTimeout(t); res(null); }
  });
}
