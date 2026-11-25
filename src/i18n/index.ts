// App translation: Arabic is the source text; each locale file maps normalized Arabic text -> translation.
// Numbers are replaced by {n} in keys so "5 لعبات" and "3 لعبات" share one entry.
import gameFallback from "./game-fallback.json";
export const LANGS = ["ar", "en", "ru", "es", "pt", "fr", "de", "tr", "id", "vi", "hi", "zh", "ko", "ja", "uk", "fa"] as const;
export type Lang = (typeof LANGS)[number];
export const RTL: Lang[] = ["ar", "fa"];
export const LANG_NAMES: Record<Lang, string> = { ar: "العربية", en: "English", ru: "Русский", es: "Español", pt: "Português", fr: "Français", de: "Deutsch", tr: "Türkçe", id: "Indonesia", vi: "Tiếng Việt", hi: "हिन्दी", zh: "中文", ko: "한국어", ja: "日本語", uk: "Українська", fa: "فارسی" };
const KEY = "wall_lang";

export function pickLang(code: string | null | undefined): Lang {
  const c = (code ?? "").toLowerCase().split(/[-_]/)[0] ?? "";
  return (LANGS as readonly string[]).includes(c) ? (c as Lang) : "en";
}

export function detectLang(): Lang {
  try { const s = localStorage.getItem(KEY); if (s && (LANGS as readonly string[]).includes(s)) return s as Lang; } catch { /* ignore */ }
  const w = globalThis as unknown as { Telegram?: { WebApp?: { initDataUnsafe?: { user?: { language_code?: string } } } } };
  const tg = w.Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
  return pickLang(tg ?? (typeof navigator !== "undefined" ? navigator.language : "ar"));
}

export function setLang(l: Lang) {
  try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
  location.reload();
}

const NUM = /[0-9٠-٩][0-9٠-٩,.]*/g;
export function normKey(s: string) { return s.replace(/\s+/g, " ").trim().replace(NUM, "{n}"); }

const LOOSE = /\{n\}|[0-9٠-٩][0-9٠-٩,.]*|[A-Za-z$#@][\w$#@.]*/g;
const looseCache = new WeakMap<Record<string, string>, Record<string, string>>();
function loose(dict: Record<string, string>) {
  let m = looseCache.get(dict);
  if (!m) {
    m = {};
    for (const [k, v] of Object.entries(dict)) {
      const ks = k.match(LOOSE) ?? [];
      // Turn each token of the key into a slot so it can be refilled from the live text.
      const used = new Set<number>();
      const vv = v.replace(LOOSE, (tok) => {
        const at = ks.findIndex((x, i) => x === tok && !used.has(i));
        if (at < 0) return tok;
        used.add(at);
        return `{${at}}`;
      });
      m[k.replace(LOOSE, "{n}")] = vv;
    }
    looseCache.set(dict, m);
  }
  return m;
}

function exact(s: string, dict: Record<string, string>): string | null {
  const hit = dict[normKey(s)];
  if (hit) { const nums = s.match(NUM) ?? []; let i = 0; return hit.replace(/\{n\}/g, () => nums[i++] ?? ""); }
  const core = s.replace(/\s+/g, " ").trim();
  const lh = loose(dict)[core.replace(LOOSE, "{n}")];
  if (lh) { const toks = core.match(LOOSE) ?? []; return lh.replace(/\{(\d+)\}/g, (_, i) => toks[Number(i)] ?? ""); }
  return null;
}

function translateCore(s: string, dict: Record<string, string>): string | null {
  const t = exact(s, dict);
  if (t) return t;
  // Hero ranks like "كايل IV": translate the name, keep the numeral.
  const roman = s.match(/^(.*?)(\s+[IVXLC]+)$/);
  if (roman?.[1]) { const r = translateCore(roman[1], dict); if (r) return r + (roman[2] ?? ""); }
  // Titles joined by separators: translate each part.
  for (const sep of [" — ", " · ", ": ", " - ", "، "]) {
    if (s.includes(sep)) {
      const parts = s.split(sep).map((p) => (/[\u0600-\u06FF]/.test(p) ? translateCore(p, dict) : p));
      if (parts.every((p) => p != null)) return parts.join(sep);
    }
  }
  return null;
}

export function translateText(s: string, dict: Record<string, string>): string | null {
  if (!/[\u0600-\u06FF]/.test(s)) return null;
  const body = translateCore(s.trim(), dict);
  if (body == null) return null;
  const lead = s.match(/^\s*/)?.[0] ?? "", trail = s.match(/\s*$/)?.[0] ?? "";
  return lead + body + trail;
}

const files = import.meta.glob<{ default: Record<string, string> }>("./locales/*.json");
export async function loadDict(l: Lang): Promise<Record<string, string>> {
  if (l === "ar") return {};
  const f = files[`./locales/${l}.json`];
  return { ...gameFallback, ...(f ? (await f()).default : {}) };
}

// Shared dictionary for code that translates before inserting names (story lines, typewriter text).
let ACTIVE: Record<string, string> = {};
let version = 0;
const listeners = new Set<() => void>();
export function setActiveDict(d: Record<string, string>) { ACTIVE = d; version++; listeners.forEach((f) => f()); }
/** Lets screens that translate in code re-render once the dictionary has loaded. */
export function subscribeDict(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; }
export const dictVersion = () => version;
export function tr(s: string): string { return translateText(s, ACTIVE) ?? s; }
/** Sentence with named slots, e.g. trf("حصلت على {card}", { card }): the template is one locale entry, each slot is translated on its own. */
export function trf(tpl: string, vars: Record<string, string | number>, dict: Record<string, string> = ACTIVE): string {
  let out = dict[tpl] ?? tpl;
  for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(typeof v === "number" ? String(v) : translateText(v, dict) ?? v);
  return out;
}
