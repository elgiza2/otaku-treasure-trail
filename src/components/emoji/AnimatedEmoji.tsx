import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import { EMOJI, type EmojiName } from "./emoji-registry";

type Lottie = typeof import("lottie-web/build/player/lottie_light").default;
let lottiePromise: Promise<Lottie> | null = null;
const jsonCache = new Map<string, Promise<unknown>>();

function loadLottie() {
  lottiePromise ??= import("lottie-web/build/player/lottie_light").then((m) => m.default);
  return lottiePromise;
}

function loadJson(url: string) {
  if (!jsonCache.has(url)) jsonCache.set(url, fetch(url).then((r) => r.json()));
  return jsonCache.get(url)!;
}

/** Resolve any CSS color (oklch tokens included) to 0–1 RGB through a 1px canvas. */
function cssColorToRgb(color: string): [number, number, number] {
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r! / 255, g! / 255, b! / 255];
}

// The pack is monochrome "repaintable" emoji: tint every color toward the target,
// keeping lighter source shades lighter so facets stay readable.
function tint(rgb: number[], target: [number, number, number]) {
  const lum = 0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!;
  const mix = lum * 0.55;
  for (let i = 0; i < 3; i++) rgb[i] = target[i]! + (1 - target[i]!) * mix;
}

function recolor(node: unknown, target: [number, number, number]) {
  if (Array.isArray(node)) {
    node.forEach((n) => recolor(n, target));
    return;
  }
  if (!node || typeof node !== "object") return;
  const o = node as Record<string, unknown>;
  if ((o['ty'] === "fl" || o['ty'] === "st") && o['c'] && typeof o['c'] === "object") {
    const c = o['c'] as { a: number; k: unknown };
    if (c.a === 0 && Array.isArray(c.k)) tint(c.k as number[], target);
    else if (Array.isArray(c.k))
      (c.k as { s?: number[]; e?: number[] }[]).forEach((kf) => {
        if (kf.s) tint(kf.s, target);
        if (kf.e) tint(kf.e, target);
      });
  }
  if ((o['ty'] === "gf" || o['ty'] === "gs") && o['g'] && typeof o['g'] === "object") {
    const g = o['g'] as { p: number; k: { a: number; k: number[] } };
    if (g.k?.a === 0 && Array.isArray(g.k.k)) {
      for (let i = 0; i < g.p; i++) {
        const stop = g.k.k.slice(i * 4 + 1, i * 4 + 4);
        tint(stop, target);
        g.k.k.splice(i * 4 + 1, 3, ...stop);
      }
    }
  }
  for (const v of Object.values(o)) if (v && typeof v === "object") recolor(v, target);
}

/**
 * Animated emoji rendered with Lottie. Color comes from the element's CSS `color`
 * (use text-* token classes). Plays only while on screen.
 */
export function AnimatedEmoji({
  name,
  className,
  loop = true,
  keepColors = false,
}: {
  name: EmojiName;
  className?: string;
  loop?: boolean;
  /** Full-colour emoji (e.g. the verified badge) skip tinting. */
  keepColors?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let anim: { destroy: () => void; play: () => void; pause: () => void } | null = null;
    let io: IntersectionObserver | null = null;
    let alive = true;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    Promise.all([loadLottie(), loadJson(EMOJI[name])])
      .then(([lottie, json]) => {
        if (!alive) return;
        const data = structuredClone(json);
        if (!keepColors) recolor(data, cssColorToRgb(getComputedStyle(el).color));
        anim = lottie.loadAnimation({
          container: el,
          renderer: "svg",
          loop,
          autoplay: !reduced,
          animationData: data,
          rendererSettings: { preserveAspectRatio: "xMidYMid meet" },
        });
        if (reduced) return;
        io = new IntersectionObserver(([e]) => (e?.isIntersecting ? anim?.play() : anim?.pause()));
        io.observe(el);
      })
      .catch(() => {});

    return () => {
      alive = false;
      io?.disconnect();
      anim?.destroy();
    };
  }, [name, loop, keepColors]);

  return <span ref={ref} aria-hidden className={cn("inline-block shrink-0 [&>svg]:block", className)} />;
}
