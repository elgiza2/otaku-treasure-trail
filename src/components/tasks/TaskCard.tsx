import { Check, Loader2 } from "lucide-react";

import { AnimatedEmoji } from "@/components/emoji/AnimatedEmoji";
import { emojiName } from "@/components/emoji/emoji-registry";
import { COIN, formatAmount } from "@/lib/coin";
import { formatCountdown, type TaskDTO, type TaskState } from "@/lib/tasks-model";
import { cn } from "@/lib/utils";

function actionLabel(task: TaskDTO, state: TaskState): string {
  if (state.type === "verify") return "تحقق";
  if (state.type === "ready") return "استلم";
  if (state.type === "progress") return "ادعُ";
  if (task.kind === "wallet") return "اربط";
  if (task.kind === "share") return "مشاركة";
  return "اذهب";
}

export function TaskCard({
  task,
  state,
  now,
  busy,
  onAction,
  index,
}: {
  task: TaskDTO;
  state: TaskState;
  now: number;
  busy: boolean;
  onAction: () => void;
  index: number;
}) {
  const finished = state.type === "done";
  return (
    <article
      className={cn(
        "glass-card animate-rise flex items-center gap-3 rounded-[1.5rem] p-3.5",
        finished && "opacity-60",
      )}
      style={{ animationDelay: `${Math.min(index, 8) * 45 + 120}ms` }}
    >
      <span className={cn("grid size-[3.25rem] shrink-0 place-items-center rounded-2xl")}>
        <AnimatedEmoji name={emojiName(task.emoji)} className="size-8 text-foreground" />
      </span>

      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[0.95rem] font-semibold text-foreground">{task.title}</h3>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="font-display text-sm font-extrabold text-gold" dir="ltr">
            +{formatAmount(task.reward)} {COIN.symbol}
          </span>
          {task.cooldownHours ? (
            <span className="rounded-full bg-background/50 px-2 py-0.5 text-[0.68rem] text-muted-foreground">
              كل {task.cooldownHours} س
            </span>
          ) : null}
          {state.type === "progress" ? (
            <span className="rounded-full bg-background/50 px-2 py-0.5 text-[0.68rem] text-muted-foreground" dir="ltr">
              {state.have}/{state.need}
            </span>
          ) : null}
        </div>
      </div>

      {state.type === "cooldown" ? (
        <span dir="ltr" className="shrink-0 font-display text-sm font-bold tabular-nums text-muted-foreground">
          {formatCountdown(state.until - now)}
        </span>
      ) : finished ? (
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-success/15 text-success">
          <Check className="size-5" strokeWidth={3} />
        </span>
      ) : (
        <button
          type="button"
          onClick={onAction}
          disabled={busy}
          className={cn(
            "flex h-10 min-w-[4.75rem] shrink-0 items-center justify-center rounded-full px-4 font-display text-sm font-bold transition-transform active:scale-95 disabled:opacity-70",
            state.type === "verify" || state.type === "ready"
              ? "bg-success text-primary-foreground"
              : "btn-cta",
          )}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : actionLabel(task, state)}
        </button>
      )}
    </article>
  );
}
