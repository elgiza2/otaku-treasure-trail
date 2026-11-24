import { Check, Clock, Flame, Loader2 } from "lucide-react";

import { AnimatedEmoji } from "@/components/emoji/AnimatedEmoji";
import { COIN, formatAmount } from "@/lib/coin";
import { CHECKIN_DAYS, checkinReward, checkinState, formatCountdown, type PlayerDTO } from "@/lib/tasks-model";
import { cn } from "@/lib/utils";

function DayCell({ day, done, today, big }: { day: number; done: boolean; today: boolean; big?: boolean }) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center gap-1 rounded-2xl border py-2.5 transition-colors",
        done && "border-success/50 bg-success/10",
        !done && today && "border-accent/70 bg-accent/10",
        !done && !today && "border-border bg-background/30",
        big && "gap-2 border-accent/40 bg-accent/[0.06]",
      )}
    >
      {big && (
        <span className="absolute -top-2.5 rounded-full bg-destructive px-2.5 py-0.5 text-[0.65rem] font-semibold text-destructive-foreground">
          مكافأة
        </span>
      )}
      <span className={cn("text-[0.7rem] font-semibold", done ? "text-success" : "text-muted-foreground")}>ي{day}</span>
      <span className="relative">
        <span className={cn("grid place-items-center rounded-full", big ? "size-14" : "size-9")}>
          <AnimatedEmoji name={big ? "gem" : "ore"} className={cn("text-gold", big ? "size-9" : "size-6")} />
        </span>
        {done && (
          <span className="absolute -bottom-1 -left-1 grid size-4 place-items-center rounded-full bg-success text-primary-foreground ring-2 ring-background">
            <Check className="size-2.5" strokeWidth={3.5} />
          </span>
        )}
      </span>
      <span dir="ltr" className={cn("font-display font-extrabold", big ? "text-xl text-gold" : "text-sm text-foreground")}>
        +{checkinReward(day)}
      </span>
    </div>
  );
}

export function CheckinCard({
  player,
  now,
  onClaim,
  claiming,
}: {
  player: PlayerDTO | null;
  now: number;
  onClaim: () => void;
  claiming: boolean;
}) {
  const state = checkinState(player?.streak ?? 0, player?.lastCheckinAt ?? null, now || Date.now());
  const done = state.doneDays;
  const todayDay = state.claimable ? state.nextDay : null;
  const shownDay = state.claimable ? state.nextDay : Math.max(1, done);
  const streakDays = state.claimable && state.nextDay === 1 ? 0 : player?.streak ?? 0;

  return (
    <section className="glass-card animate-rise rounded-[1.75rem] p-4" style={{ animationDelay: "80ms" }}>
      <header className="flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl">
          <AnimatedEmoji name="rays" className="size-8 text-gold" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[1.05rem] font-extrabold text-foreground">تسجيل الحضور اليومي</h2>
          <p className="text-xs text-muted-foreground">
            اليوم {shownDay} من {CHECKIN_DAYS} · {formatAmount(player?.weekEarned ?? 0)} هذا الأسبوع
          </p>
        </div>
        <span className="flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive-foreground">
          <Flame className="size-3.5 text-accent" />
          {streakDays > 0 ? `سلسلة ${streakDays} ${streakDays > 2 && streakDays < 11 ? "أيام" : "يوم"}` : "ابدأ سلستك"}
        </span>
      </header>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-background/50">
        <div
          className="bg-gold-bar h-full origin-right rounded-full transition-transform duration-700"
          style={{ transform: `scaleX(${done / CHECKIN_DAYS})` }}
        />
      </div>

      <div className="mt-4 grid grid-cols-4 grid-rows-2 gap-2">
        {Array.from({ length: 6 }, (_, i) => i + 1).map((d) => (
          <DayCell key={d} day={d} done={d <= done} today={d === todayDay} />
        ))}
        <div className="col-start-4 row-span-2 row-start-1 grid">
          <DayCell day={7} done={done >= 7} today={todayDay === 7} big />
        </div>
      </div>

      {state.claimable ? (
        <button
          type="button"
          onClick={onClaim}
          disabled={claiming}
          className="btn-cta mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl font-display text-base font-bold transition-transform active:scale-[0.98] disabled:opacity-70"
        >
          {claiming ? <Loader2 className="size-5 animate-spin" /> : null}
          استلم
          <span dir="ltr">
            +{checkinReward(state.nextDay)} {COIN.symbol}
          </span>
        </button>
      ) : (
        <div className="mt-4 flex items-center justify-between rounded-2xl border border-dashed border-accent/30 bg-background/40 px-4 py-3">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="size-4 text-accent" />
            المكافأة التالية خلال
          </span>
          <span dir="ltr" className="font-display text-lg font-extrabold tabular-nums text-accent">
            {state.nextAt ? formatCountdown(state.nextAt - now) : "—"}
          </span>
        </div>
      )}
    </section>
  );
}
