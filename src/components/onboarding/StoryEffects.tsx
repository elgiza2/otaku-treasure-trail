import { useEffect, useRef } from "react";

import type { StoryEffect } from "./story-slides";

/*
 * Live per-slide atmosphere drawn on a canvas over the artwork:
 *  - embers: wind-blown warm dust over the wall at dusk
 *  - sparks: pickaxe impact bursts, floating dust, flickering lanterns
 *  - rain:   slanted rain, ground mist and lightning flashes
 *  - dawn:   rotating sun rays and rising gold motes
 * Anchor points are given in image space (0..1 of the artwork) and mapped through
 * the same cover/top-center fit as the <img>, so they stay on the pickaxe, lanterns
 * and sun at any screen size.
 */

type P = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; hue: number };

const rand = (a: number, b: number) => a + Math.random() * (b - a);

// Slide artwork is 1088x1920, drawn with object-fit: cover + object-position: top center.
const IMG_W = 1088;
const IMG_H = 1920;

export function StoryEffects({ effect }: { effect: StoryEffect }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      // Layout size (ignores the Ken Burns transform on the parent).
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    // Map an image-space point (0..1) to canvas pixels.
    const toCanvas = (ix: number, iy: number): [number, number] => {
      const scale = Math.max(w / IMG_W, h / IMG_H);
      const dw = IMG_W * scale;
      return [(w - dw) / 2 + ix * dw, iy * IMG_H * scale];
    };
    const imgScale = () => Math.max(w / IMG_W, h / IMG_H) * IMG_W;

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let particles: P[] = [];
    let drops: { x: number; y: number; len: number; speed: number; alpha: number }[] = [];
    let flash = 0;
    let nextFlash = performance.now() + rand(1200, 2500);
    let bolt: { pts: [number, number][]; life: number } | null = null;
    // The mine clip animates its own pickaxe sparks, so canvas bursts stay off.
    let nextBurst = Number.POSITIVE_INFINITY;
    let raf = 0;
    let last = performance.now();

    if (effect === "rain") {
      drops = Array.from({ length: 260 }, () => ({
        x: rand(-0.2, 1.2),
        y: rand(0, 1),
        len: rand(14, 30),
        speed: rand(0.9, 1.5),
        alpha: rand(0.18, 0.45),
      }));
    }
    if (effect === "embers" || effect === "dawn" || effect === "sparks") {
      const count = effect === "sparks" ? 45 : 70;
      particles = Array.from({ length: count }, () => spawnAmbient(effect, true));
    }

    function spawnAmbient(kind: StoryEffect, anywhere = false): P {
      if (kind === "embers") {
        return {
          x: anywhere ? rand(0, 1) : rand(1, 1.1),
          y: rand(0.05, 0.85),
          vx: rand(-0.07, -0.03),
          vy: rand(-0.012, 0.012),
          life: 0,
          max: rand(6, 12),
          size: rand(0.8, 2.4),
          hue: rand(22, 40),
        };
      }
      if (kind === "dawn") {
        return {
          x: rand(0, 1),
          y: anywhere ? rand(0.1, 0.9) : rand(0.85, 0.95),
          vx: rand(-0.006, 0.006),
          vy: rand(-0.03, -0.012),
          life: 0,
          max: rand(6, 11),
          size: rand(0.8, 2.6),
          hue: rand(38, 50),
        };
      }
      // sparks ambient dust
      return {
        x: rand(0, 1),
        y: rand(0.05, 0.85),
        vx: rand(-0.006, 0.006),
        vy: rand(-0.008, 0.004),
        life: anywhere ? rand(0, 6) : 0,
        max: rand(6, 10),
        size: rand(0.6, 1.6),
        hue: rand(35, 45),
      };
    }

    function burst() {
      // Pickaxe impact point on the mine artwork
      const [px, py] = toCanvas(0.88, 0.47);
      const ox = px / w;
      const oy = py / h;
      for (let i = 0; i < 34; i++) {
        const a = rand(Math.PI * 0.55, Math.PI * 1.35);
        const s = rand(0.15, 0.55);
        particles.push({
          x: ox,
          y: oy,
          vx: Math.cos(a) * s * 0.6,
          vy: Math.sin(a) * s * 0.45 - 0.08,
          life: 0,
          max: rand(0.5, 1.1),
          size: rand(1, 2.4),
          hue: rand(30, 48),
        });
      }
      flash = Math.max(flash, 0.5);
    }

    function makeBolt() {
      const pts: [number, number][] = [];
      let x = rand(0.15, 0.85) * w;
      let y = 0;
      pts.push([x, y]);
      while (y < h * rand(0.28, 0.42)) {
        x += rand(-28, 28);
        y += rand(14, 30);
        pts.push([x, y]);
      }
      bolt = { pts, life: 0.35 };
    }

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      ctx.clearRect(0, 0, w, h);

      if (effect === "rain") {
        if (now > nextFlash) {
          flash = 1;
          makeBolt();
          nextFlash = now + rand(2600, 5200);
        }
        ctx.lineCap = "round";
        for (const d of drops) {
          d.y += d.speed * dt * 1.6;
          d.x -= d.speed * dt * 0.28;
          if (d.y > 1.05) {
            d.y = rand(-0.1, 0);
            d.x = rand(-0.1, 1.25);
          }
          const x = d.x * w;
          const y = d.y * h;
          ctx.strokeStyle = `rgba(205,218,240,${d.alpha})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + d.len * 0.18, y - d.len);
          ctx.stroke();
        }
        // ground mist
        const g = ctx.createLinearGradient(0, h * 0.55, 0, h * 0.8);
        g.addColorStop(0, "rgba(150,165,190,0)");
        g.addColorStop(1, "rgba(150,165,190,0.10)");
        ctx.fillStyle = g;
        ctx.fillRect(0, h * 0.55, w, h * 0.25);

        if (bolt) {
          bolt.life -= dt;
          if (bolt.life > 0) {
            ctx.strokeStyle = `rgba(230,238,255,${Math.min(1, bolt.life * 4)})`;
            ctx.lineWidth = 2;
            ctx.shadowColor = "rgba(190,210,255,0.9)";
            ctx.shadowBlur = 16;
            ctx.beginPath();
            bolt.pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
            ctx.stroke();
            ctx.shadowBlur = 0;
          } else bolt = null;
        }
        if (flash > 0) {
          // double-strobe flash
          const a = flash > 0.55 ? flash * 0.35 : flash * 0.18 * (Math.sin(now / 30) > 0 ? 1 : 0.4);
          ctx.fillStyle = `rgba(200,215,255,${a})`;
          ctx.fillRect(0, 0, w, h);
          flash -= dt * 2.2;
        }
      }

      if (effect === "dawn") {
        // rotating god rays from the sun
        const [sx, sy] = toCanvas(0.83, 0.17);
        const rot = now / 9000;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < 14; i++) {
          const a = rot + (i / 14) * Math.PI * 2;
          const len = Math.max(w, h) * 1.1;
          const spread = 0.05 + 0.03 * Math.sin(now / 1400 + i);
          const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, len);
          grad.addColorStop(0, "rgba(255,215,140,0.09)");
          grad.addColorStop(1, "rgba(255,215,140,0)");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.arc(sx, sy, len, a - spread, a + spread);
          ctx.closePath();
          ctx.fill();
        }
        const pulse = 0.25 + 0.08 * Math.sin(now / 900);
        const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, imgScale() * 0.35);
        glow.addColorStop(0, `rgba(255,225,160,${pulse})`);
        glow.addColorStop(1, "rgba(255,225,160,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }

      if (effect === "sparks") {
        if (now > nextBurst) {
          burst();
          nextBurst = now + rand(1100, 1700);
        }
        // flickering lanterns
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (const [lx, ly, r] of [
          [0.085, 0.14, 0.2],
          [0.16, 0.19, 0.12],
          [0.73, 0.29, 0.14],
        ] as const) {
          const f = 0.16 + 0.07 * Math.sin(now / 90 + lx * 40) + rand(-0.03, 0.03);
          const [cx, cy] = toCanvas(lx, ly);
          const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * imgScale());
          grd.addColorStop(0, `rgba(255,170,70,${f})`);
          grd.addColorStop(1, "rgba(255,170,70,0)");
          ctx.fillStyle = grd;
          ctx.fillRect(0, 0, w, h);
        }
        // gold vein glow
        const vein = 0.1 + 0.08 * Math.max(0, flash);
        const [vx, vy] = toCanvas(0.88, 0.47);
        const vg = ctx.createRadialGradient(vx, vy, 0, vx, vy, 0.35 * imgScale());
        vg.addColorStop(0, `rgba(255,200,80,${vein + 0.12})`);
        vg.addColorStop(1, "rgba(255,200,80,0)");
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
        if (flash > 0) flash -= dt * 2.5;
      }

      // particles (embers, dust, sparks, motes)
      if (particles.length) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const next: P[] = [];
        for (const p of particles) {
          p.life += dt;
          const isSpark = effect === "sparks" && p.max < 1.2;
          if (isSpark) p.vy += 0.9 * dt; // gravity
          if (effect === "embers") p.vy += Math.sin(now / 700 + p.x * 12) * 0.0006;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          const t = p.life / p.max;
          if (t >= 1 || p.x < -0.1 || p.x > 1.15 || p.y < -0.1 || p.y > 1.1) {
            if (!isSpark) next.push(spawnAmbient(effect));
            continue;
          }
          const fade = isSpark ? 1 - t : Math.sin(Math.PI * t);
          const x = p.x * w;
          const y = p.y * h;
          if (isSpark) {
            ctx.strokeStyle = `hsla(${p.hue},100%,65%,${fade})`;
            ctx.lineWidth = p.size;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x - p.vx * w * 0.03, y - p.vy * h * 0.03);
            ctx.stroke();
          } else {
            const twinkle = effect === "dawn" ? 0.6 + 0.4 * Math.sin(now / 200 + p.x * 50) : 1;
            const r = p.size * 3;
            const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
            grd.addColorStop(0, `hsla(${p.hue},100%,70%,${0.85 * fade * twinkle})`);
            grd.addColorStop(1, `hsla(${p.hue},100%,60%,0)`);
            ctx.fillStyle = grd;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
          }
          next.push(p);
        }
        particles = next;
        ctx.restore();
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [effect]);

  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />;
}
