import { Loader2 } from "lucide-react";

import { AnimatedEmoji } from "@/components/emoji/AnimatedEmoji";
import { AD_MIN_REWARD } from "@/lib/shop-model";
import { COIN, formatAmount } from "@/lib/coin";
import { TOURNAMENT_AD_POINTS } from "@/lib/tournament-model";

/** Always-open dual ad task (Adsgram + Monetag): unlimited ads, no cooldown, pays ANIME + tournament points. */
export function AdTaskCard({
  busy,
  watched,
  onWatch,
}: {
  busy: boolean;
  watched: number;
  onWatch: () => void;
}) {
  return (
    <article className="glass-card animate-rise rounded-[1.5rem] p-3.5">
      <div className="flex items-center gap-3">
        <span className="grid size-[3.25rem] shrink-0 place-items-center rounded-2xl">
          <AnimatedEmoji name="rocket" className="size-8 text-accent" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[0.95rem] font-semibold text-foreground">اتفرج على إعلان واكسب</h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="font-display text-sm font-extrabold text-gold" dir="ltr">
              +{formatAmount(AD_MIN_REWARD)} {COIN.symbol}
            </span>
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[0.68rem] font-bold text-accent">
              +{TOURNAMENT_AD_POINTS} نقاط مسابقة
            </span>
            <span className="rounded-full bg-background/50 px-2 py-0.5 text-[0.68rem] text-muted-foreground">بلا حد</span>
            {watched > 0 ? (
              <span className="rounded-full bg-background/50 px-2 py-0.5 text-[0.68rem] text-muted-foreground" dir="ltr">
                ×{watched}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onWatch}
        disabled={busy}
        className="btn-cta mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 font-display text-sm font-extrabold transition-transform active:scale-95 disabled:opacity-70"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <AnimatedEmoji name="sparkle" className="size-5 text-primary-foreground" />}
        <span>شاهد إعلان</span>
      </button>
    </article>
  );
}
