import { useEffect, useSyncExternalStore } from "react";
import { detectLang, dictVersion, loadDict, RTL, setActiveDict, subscribeDict, translateText } from "./index";

/** Re-render when the player's dictionary arrives (for text translated in code, like the story). */
export function useDictReady() { return useSyncExternalStore(subscribeDict, dictVersion, () => 0); }

// Translates rendered Arabic text in place (after hydration), so every screen follows the player's Telegram language.
const ATTRS = ["placeholder", "title", "aria-label", "alt"];
export function DomTranslator() {
  useEffect(() => {
    const lang = detectLang();
    document.documentElement.lang = lang;
    document.documentElement.dir = RTL.includes(lang) ? "rtl" : "ltr";
    if (lang === "ar") return;
    let obs: MutationObserver | null = null;
    let dead = false;
    const done = new WeakMap<Node, string>();
    loadDict(lang).then((dict) => {
      if (dead) return;
      setActiveDict(dict);
      const text = (n: Text) => {
        if (n.parentElement?.closest("[data-no-tr]")) return;
        const v = n.nodeValue ?? "";
        if (done.get(n) === v) return;
        const t = translateText(v, dict);
        if (t != null && t !== v) { done.set(n, t); n.nodeValue = t; }
      };
      const el = (e: Element) => {
        if (e.closest("[data-no-tr]")) return;
        for (const a of ATTRS) { const v = e.getAttribute(a); if (v) { const t = translateText(v, dict); if (t) e.setAttribute(a, t); } }
      };
      const walk = (root: Node) => {
        if (root.nodeType === 3) return text(root as Text);
        if (root.nodeType !== 1) return;
        el(root as Element);
        const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
        for (let n = w.nextNode(); n; n = w.nextNode()) n.nodeType === 3 ? text(n as Text) : el(n as Element);
      };
      walk(document.body);
      document.title = translateText(document.title, dict) ?? document.title;
      obs = new MutationObserver((ms) => {
        for (const m of ms) {
          if (m.type === "characterData") text(m.target as Text);
          else if (m.type === "attributes") el(m.target as Element);
          else m.addedNodes.forEach(walk);
        }
      });
      obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    });
    return () => { dead = true; obs?.disconnect(); };
  }, []);
  return null;
}
