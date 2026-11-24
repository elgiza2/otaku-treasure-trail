import { afterEach, describe, expect, it, vi } from "vitest";
import { detectLang, LANGS, pickLang } from "@/i18n";
import { BOT_EN, bt } from "@/lib/bot-i18n";
import locales from "@/lib/bot-locales.json";

afterEach(() => vi.unstubAllGlobals());

describe("automatic player language", () => {
  for (const lang of LANGS) {
    it(`uses Telegram ${lang} without a saved preference`, () => {
      vi.stubGlobal("localStorage", { getItem: () => null });
      vi.stubGlobal("Telegram", { WebApp: { initDataUnsafe: { user: { language_code: lang } } } });
      vi.stubGlobal("navigator", { language: "en-US" });
      expect(detectLang()).toBe(lang);
    });
  }
  it("respects the player's explicit language selection", () => {
    vi.stubGlobal("localStorage", { getItem: () => "ja" });
    vi.stubGlobal("Telegram", { WebApp: { initDataUnsafe: { user: { language_code: "ar" } } } });
    expect(detectLang()).toBe("ja");
  });
  it("uses the device language outside Telegram", () => {
    vi.stubGlobal("localStorage", { getItem: () => null });
    vi.stubGlobal("Telegram", undefined);
    vi.stubGlobal("navigator", { language: "pt-BR" });
    expect(detectLang()).toBe("pt");
    expect(pickLang("zh-CN")).toBe("zh");
    expect(pickLang("unknown")).toBe("en");
  });
});

describe("bot locale completeness", () => {
  for (const [lang, dict] of Object.entries(locales)) {
    it(`${lang} preserves every message and variable`, () => {
      for (const key of Object.keys(BOT_EN) as (keyof typeof BOT_EN)[]) {
        const value = (dict as Record<string, string>)[key];
        expect(value, `${lang}: ${key}`).toBeTruthy();
        expect(value?.match(/\{\w+\}/g) ?? []).toEqual(BOT_EN[key].match(/\{\w+\}/g) ?? []);
        expect(bt(lang, key, { name: "Player", coins: 100 })).not.toMatch(/\{\w+\}/);
      }
    });
  }
});