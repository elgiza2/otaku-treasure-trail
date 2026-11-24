import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/** Seek only the hidden decoder; reveal its playing frame with a soft dissolve. */
export function SegmentVideo({ src, poster, className }: { src: string; poster?: string; className?: string }) {
  const first = useRef<HTMLVideoElement>(null);
  const second = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const a = first.current;
    const b = second.current;
    if (!a || !b) return;
    const videos = [a, b];
    let active = 0;
    let end = 0;
    let prepared = false;
    let changing = false;
    let disposed = false;
    let frame = 0;
    let fadeTimer: ReturnType<typeof setTimeout> | undefined;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fadeMs = reduced ? 0 : 420;

    function prepare() {
      const hidden = videos[1 - active];
      const current = videos[active];
      if (!hidden || !current || hidden.readyState < 1 || !Number.isFinite(hidden.duration)) return;
      const length = Math.min(hidden.duration - 0.1, 2.8 + Math.random() * 1.4);
      const start = Math.random() * Math.max(0, hidden.duration - length - 0.5);
      hidden.pause();
      hidden.classList.toggle("segment-mirrored", Math.random() < 0.5);
      prepared = false;
      const seeked = () => { if (!disposed) prepared = true; };
      hidden.addEventListener("seeked", seeked, { once: true });
      hidden.currentTime = start;
      if (Math.abs(hidden.currentTime - start) < 0.01 && !hidden.seeking) prepared = true;
      end = Math.min(current.duration - 0.5, current.currentTime + length);
    }

    async function change() {
      const old = videos[active];
      const next = videos[1 - active];
      if (!old || !next || changing || !prepared) return;
      changing = true;
      try {
        await next.play();
        // Do not fade to the poster/previous decode while a seek is finishing.
        if (next.requestVideoFrameCallback) await new Promise<void>((resolve) => next.requestVideoFrameCallback(() => resolve()));
        if (disposed) return;
        next.classList.add("segment-visible");
        old.classList.remove("segment-visible");
        fadeTimer = setTimeout(() => {
          if (disposed) return;
          old.pause();
          active = 1 - active;
          changing = false;
          prepare();
        }, fadeMs);
      } catch {
        changing = false;
      }
    }

    const tick = () => {
      if (disposed) return;
      const current = videos[active];
      if (current && prepared && (current.currentTime >= end || current.ended)) void change();
      frame = requestAnimationFrame(tick);
    };
    const ready = () => {
      if (a.readyState >= 2 && b.readyState >= 2 && !end) {
        void a.play().catch(() => {});
        prepare();
      }
    };
    a.classList.add("segment-visible");
    b.classList.remove("segment-visible");
    videos.forEach((v) => v.addEventListener("loadeddata", ready));
    ready();
    frame = requestAnimationFrame(tick);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      clearTimeout(fadeTimer);
      videos.forEach((v) => { v.removeEventListener("loadeddata", ready); v.pause(); });
    };
  }, [src]);
  return <div className={cn("overflow-hidden", className)} aria-hidden="true">
    <video ref={first} src={src} poster={poster} autoPlay muted playsInline preload="auto" className="segment-video segment-visible" />
    <video ref={second} src={src} muted playsInline preload="auto" className="segment-video" />
  </div>;
}
