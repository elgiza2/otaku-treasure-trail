import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

import { getTonConnect, shortTonAddress } from "@/lib/ton-connect";
import { StoryEffects } from "./StoryEffects";
import { STORY_SLIDES, type StorySlide } from "./story-slides";

const SLIDE_MS = 6500;

/** Looping clip of the heroine; only the active slide plays, the next one preloads. */
function SlideMedia({ slide, active, preload }: { slide: StorySlide; active: boolean; preload: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (active) {
      v.currentTime = 0;
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [active]);

  if (reduced) {
    return (
      <img src={slide.image} alt="" width={1088} height={1920} className="h-full w-full object-cover object-top" draggable={false} />
    );
  }
  return (
    <video
      ref={ref}
      src={slide.video}
      poster={slide.image}
      muted
      loop
      playsInline
      preload={active || preload ? "auto" : "none"}
      disablePictureInPicture
      className="h-full w-full object-cover object-top"
    />
  );
}

export function StoryOnboarding({ onConnected }: { onConnected?: (address: string) => void }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [wallet, setWallet] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const total = STORY_SLIDES.length;
  const isLast = index === total - 1;
  const slide = STORY_SLIDES[index] ?? STORY_SLIDES[0]!;

  useEffect(() => {
    STORY_SLIDES.forEach((s) => {
      const img = new Image();
      img.src = s.image;
    });
  }, []);

  // Small haptic kick on the titan attack beat inside Telegram.
  useEffect(() => {
    if (!slide.alarm) return;
    const tg = (window as unknown as { Telegram?: { WebApp?: { HapticFeedback?: { impactOccurred: (s: string) => void } } } })
      .Telegram?.WebApp?.HapticFeedback;
    tg?.impactOccurred("heavy");
  }, [slide.alarm]);

  // Restore an existing wallet session and follow connect/disconnect events.
  useEffect(() => {
    let unsub: (() => void) | undefined;
    let alive = true;
    getTonConnect()
      .then((ui) => {
        if (!alive) return;
        const sync = async (raw: string | undefined) => {
          if (!alive) return;
          setWallet(raw ? await shortTonAddress(raw) : null);
          if (raw) onConnected?.(raw);
        };
        void sync(ui.account?.address);
        unsub = ui.onStatusChange((w) => {
          setConnecting(false);
          void sync(w?.account.address);
          if (w) toast.success("تم ربط محفظتك بنجاح");
        });
        ui.onModalStateChange((s) => {
          if (s.status === "closed") setConnecting(false);
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
      unsub?.();
    };
  }, [onConnected]);

  const next = useCallback(() => setIndex((i) => Math.min(i + 1, total - 1)), [total]);
  const prev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);

  const connectWallet = async () => {
    if (wallet) return;
    setConnecting(true);
    try {
      const ui = await getTonConnect();
      await ui.openModal();
    } catch {
      setConnecting(false);
      toast.error("تعذّر فتح نافذة المحفظة، حاول مرة أخرى");
    }
  };

  return (
    <main className="relative mx-auto h-dvh w-full max-w-md overflow-hidden bg-background select-none">
      {/* Artwork + live effects */}
      {STORY_SLIDES.map((s, i) => (
        <div
          key={s.image}
          aria-hidden={i !== index}
          className="absolute inset-0 transition-opacity duration-700 ease-out"
          style={{ opacity: i === index ? 1 : 0 }}
        >
          <div className={`absolute inset-0 ${i === index ? "animate-kenburns" : ""}`}>
            <SlideMedia slide={s} active={i === index} preload={i === index + 1} />
            {i === index && <StoryEffects effect={s.effect} />}
          </div>
        </div>
      ))}
      <div className="story-fade pointer-events-none absolute inset-0" />
      {slide.alarm && <div key={`alarm-${index}`} className="story-alarm-vignette pointer-events-none absolute inset-0" />}

      {/* Tap zones (RTL: left = next, right = previous); hold to pause */}
      <div
        className="absolute inset-0 z-10 flex"
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => setPaused(false)}
        onPointerLeave={() => setPaused(false)}
        onPointerCancel={() => setPaused(false)}
      >
        <button type="button" aria-label="السابق" className="h-full w-1/3" onClick={prev} />
        <button type="button" aria-label="التالي" className="h-full w-2/3" onClick={next} />
      </div>

      {/* Progress bars */}
      <div className="absolute inset-x-4 top-[calc(var(--tg-safe-top,0px)+0.875rem)] z-20 flex gap-1.5">
        {STORY_SLIDES.map((_, i) => (
          <div key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-foreground/25">
            {i < index && <div className="h-full w-full rounded-full bg-foreground" />}
            {i === index && (
              <div
                key={`bar-${index}`}
                className="animate-story-progress h-full w-full origin-right rounded-full bg-foreground"
                style={
                  {
                    "--story-duration": `${SLIDE_MS}ms`,
                    animationPlayState: paused ? "paused" : "running",
                  } as React.CSSProperties
                }
                onAnimationEnd={() => {
                  if (!isLast) next();
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Glass caption card */}
      <section className="absolute inset-x-4 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-20">
        <div key={index} className="glass rounded-[2rem] px-5 pb-5 pt-6 text-center">
          <p className={`animate-rise text-xs font-semibold tracking-wide ${slide.alarm ? "text-destructive" : "text-accent"}`}>
            {slide.eyebrow}
          </p>
          <h1
            className={`mt-2 font-display text-[1.7rem] font-extrabold leading-snug ${
              slide.alarm ? "animate-quake text-alarm text-[2rem]" : "animate-slam text-foreground"
            }`}
            style={{ animationDelay: "80ms" }}
          >
            {slide.title}
          </h1>
          <p
            className="animate-rise mx-auto mt-2 max-w-[19rem] text-[0.95rem] leading-7 text-muted-foreground"
            style={{ animationDelay: "160ms" }}
          >
            {slide.body}
          </p>

          {isLast && wallet ? (
            <div className="animate-rise mt-5" style={{ animationDelay: "240ms" }}>
              <p className="mb-2 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <Check className="size-3.5 text-accent" strokeWidth={3} />
                تم ربط المحفظة
                <span dir="ltr" className="font-medium text-foreground">{wallet}</span>
              </p>
              <Link
                to="/tasks"
                search={{}}
                className="btn-cta flex h-14 w-full items-center justify-center gap-2 rounded-full font-display text-lg font-semibold transition-transform active:scale-[0.97]"
              >
                ابدأ المهام
                <ChevronLeft className="size-5" strokeWidth={2.5} />
              </Link>
            </div>
          ) : isLast ? (
            <button
              type="button"
              onClick={connectWallet}
              disabled={connecting}
              className="btn-cta animate-rise mt-5 flex h-14 w-full items-center justify-center gap-2.5 rounded-full font-display text-lg font-semibold transition-transform active:scale-[0.97] disabled:opacity-80"
              style={{ animationDelay: "240ms" }}
            >
              {connecting ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  جارٍ فتح المحفظة…
                </>
              ) : (
                <>
                  <Wallet className="size-5" strokeWidth={2.2} />
                  ربط المحفظة
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={next}
              className="btn-cta animate-rise mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-full font-display text-lg font-semibold transition-transform active:scale-[0.97]"
              style={{ animationDelay: "240ms" }}
            >
              التالي
              <ChevronLeft className="size-5" strokeWidth={2.5} />
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
