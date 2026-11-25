// Every Arabic text the app can show must have a translation in every locale.
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { LANGS, translateText, trf } from "@/i18n";
import { SAGA, PATHS, BONDS } from "@/lib/saga";
import { NFT_DESIGNS, RARITY_LABEL } from "@/lib/nft-model";
import { HEROES } from "@/components/heroes/heroes-data";
import { STORY_ITEMS } from "@/lib/story-model";
import gameFallback from "@/i18n/game-fallback.json";

const AR = /[\u0600-\u06FF]/;
const SRC = path.resolve(__dirname, "..");
// Not shown as UI text: language self-names, normalisation characters, separators, the wallet manifest name, unused legacy encounter text.
const SKIP_FILES = ["i18n/index.ts", "lib/story-model.ts", "routes/api/public/tonconnect-manifest.ts", "lib/novel-model.ts", "lib/story-i18n.server.ts"];

function sourceStrings(): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      const rel = path.relative(SRC, p);
      if (e.isDirectory()) { if (rel !== "test" && rel !== "i18n/locales") walk(p); continue; }
      if (!/\.tsx?$/.test(e.name) || SKIP_FILES.includes(rel)) continue;
      const text = fs.readFileSync(p, "utf8");
      if (!AR.test(text)) continue;
      const sf = ts.createSourceFile(p, text, ts.ScriptTarget.Latest, true, p.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      const visit = (n: ts.Node) => {
        if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isJsxText(n)) out.push(n.text);
        ts.forEachChild(n, visit);
      };
      visit(sf);
    }
  };
  walk(SRC);
  return out.filter((s) => AR.test(s) && s.trim() !== "،");
}

/** Plain texts from data files that reach the screen. */
function dataStrings(): string[] {
  const s: string[] = [];
  for (const h of HEROES) s.push(h.name, h.title, `${h.name} IV`);
  for (const d of NFT_DESIGNS) s.push(d.name);
  s.push(...Object.values(RARITY_LABEL));
  for (const p of [...Object.values(PATHS), ...Object.values(BONDS)]) s.push(p.label, p.desc);
  for (const ch of SAGA) {
    s.push(ch.act, ch.title, ch.foe, ch.ask, ...ch.moves, `${ch.act} — ${ch.title}`);
    for (const l of ch.lines) s.push(l.who, l.text);
    for (const o of ch.options) s.push(o.label, o.reply);
  }
  for (const it of STORY_ITEMS) s.push(it.label, it.desc);
  s.push("3س 20د");
  return s.filter((t) => AR.test(t));
}

/** Sentences built in code with names and numbers, exactly as the screens build them. */
function builtStrings(dict: Record<string, string>): string[] {
  const s: string[] = [];
  for (const h of HEROES) s.push(trf("{hero} بقى مستوى {level}", { hero: h.name, level: 12 }, dict));
  for (const d of NFT_DESIGNS) s.push(trf("حصلت على {card}", { card: d.name }, dict));
  for (const ch of SAGA) {
    s.push(trf("الجولة {step} من {total}: حرس {foe} قدامك.", { step: 2, total: 3, foe: ch.foe }, dict));
    s.push(trf("الجولة {step} من {total}: {foe} — الزعيم قدامك.", { step: 3, total: 3, foe: ch.foe }, dict));
    s.push(trf("مهمة جديدة (الدورة {season}): ذكريات «{title}» بترجع، والعدو بقى أقوى.", { season: 2, title: ch.title }, dict));
  }
  s.push(trf("الدورة {season}", { season: 2 }, dict), trf("إجابة صح! +{coins} {coin}", { coins: "1,200", coin: "ANIME" }, dict), trf("ترتيبك #{rank}", { rank: 3 }, dict));
  return s;
}

const dicts = Object.fromEntries(LANGS.filter((l) => l !== "ar").map((l) =>
  [l, { ...gameFallback, ...JSON.parse(fs.readFileSync(path.join(SRC, `i18n/locales/${l}.json`), "utf8")) } as Record<string, string>]));
const ALL = [...new Set([...sourceStrings(), ...dataStrings()])];

describe("translations cover every Arabic text", () => {
  for (const [lang, dict] of Object.entries(dicts)) {
    it(`${lang} has a translation for every text`, () => {
      const missing = ALL.filter((t) => { const r = translateText(t, dict); return r == null || (lang !== "fa" && AR.test(r)); });
      expect(missing).toEqual([]);
    });
    it(`${lang} translates sentences with names and numbers`, () => {
      const left = builtStrings(dict).filter((t) => (lang === "fa" ? /[{}]/.test(t) || t.includes("قدامك") || t.includes("بقى") : AR.test(t)));
      expect(left).toEqual([]);
    });
  }
});
