import avatarFallback from "@/assets/heroes/hero-1-rage.jpg";
import { formatAmount } from "@/lib/coin";
import {
  TOURNAMENT_PRIZE_TIERS,
  type PastRoundDTO,
  type TournamentLeaderDTO,
} from "@/lib/tournament-model";
import { cn } from "@/lib/utils";
import { VerifiedBadge } from '@/components/profile/MinePassCard';

const MEDALS = ["🥇", "🥈", "🥉"] as const;

function LeaderAvatar({ src, name, size = "size-10" }: { src: string | null; name: string; size?: string }) {
  return (
    <img
      src={src || avatarFallback}
      onError={(e) => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = avatarFallback;
      }}
      alt={name}
      className={cn(size, "shrink-0 rounded-full border border-accent/40 object-cover object-top")}
    />
  );
}

export function TournamentLeadersView({
  leaders,
  myTgId,
}: {
  leaders: TournamentLeaderDTO[];
  myTgId: number | null;
}) {
  if (leaders.length === 0) {
    return (
      <p className="glass-card rounded-3xl p-6 text-center text-sm text-muted-foreground">
        لا يوجد متسابقون بعد في هذه الجولة — كن أول من يحصد النقاط!
      </p>
    );
  }

  const top3 = leaders.slice(0, 3);
  const rest = leaders.slice(3);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {top3.map((l, i) => (
          <article
            key={l.tgId}
            className={cn(
              "glass-card flex flex-col items-center rounded-2xl p-3 text-center",
              l.tgId === myTgId && "ring-1 ring-accent",
            )}
          >
            <span className="text-lg">{MEDALS[i] ?? `#${l.rank}`}</span>
            <LeaderAvatar src={l.photoUrl} name={l.name} size="mt-1 size-12" />
            <div className="mt-2 flex w-full items-center justify-center gap-1"><p className="truncate text-xs font-bold text-foreground">{l.name}</p>{l.verified && <VerifiedBadge />}</div>
            <p className="mt-0.5 text-[0.7rem] font-extrabold tabular-nums text-accent" dir="ltr">
              {formatAmount(l.points)} pts
            </p>
            <span className="mt-1 rounded-full bg-accent/15 px-2 py-0.5 text-[0.68rem] font-bold text-gold" dir="ltr">
              {l.prizeGram} GRAM
            </span>
          </article>
        ))}
      </div>

      {rest.length > 0 && (
        <ul className="space-y-2">
          {rest.map((l) => (
            <li
              key={l.tgId}
              className={cn(
                "glass-card flex items-center gap-3 rounded-2xl px-3.5 py-2.5",
                l.tgId === myTgId && "ring-1 ring-accent",
              )}
            >
              <span className="w-6 shrink-0 text-center font-display text-sm font-extrabold text-muted-foreground" dir="ltr">
                #{l.rank}
              </span>
              <LeaderAvatar src={l.photoUrl} name={l.name} size="size-9" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1"><p className="truncate text-sm font-semibold text-foreground">{l.name}</p>{l.verified && <VerifiedBadge />}</div>
                <p className="text-[0.68rem] text-muted-foreground">
                  {l.adsCount} إعلان · {l.referralsCount} إحالة موثقة
                </p>
              </div>
              <div className="shrink-0 text-end">
                <p className="font-display text-sm font-extrabold tabular-nums text-foreground" dir="ltr">
                  {formatAmount(l.points)}
                </p>
                {l.prizeGram > 0 && (
                  <p className="text-[0.68rem] font-bold text-gold" dir="ltr">
                    +{l.prizeGram} GRAM
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TournamentPrizesView() {
  return (
    <ul className="space-y-2">
      {TOURNAMENT_PRIZE_TIERS.map((t) => (
        <li key={t.label} className="glass-card flex items-center justify-between rounded-2xl px-4 py-3">
          <span className="text-sm font-bold text-foreground">{t.label}</span>
          <span className="font-display text-base font-extrabold text-gold" dir="ltr">
            {t.gram} GRAM
          </span>
        </li>
      ))}
    </ul>
  );
}

export function TournamentHistoryView({ pastRounds }: { pastRounds: PastRoundDTO[] }) {
  if (pastRounds.length === 0) {
    return (
      <p className="glass-card rounded-3xl p-6 text-center text-sm text-muted-foreground">
        هذه هي الجولة الأولى — ستظهر نتائج الجولات المنتهية هنا تلقائياً بعد انتهاء الأسبوع.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {pastRounds.map((pr) => (
        <section key={pr.id} className="glass-card rounded-2xl p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-display text-sm font-extrabold text-foreground">الجولة #{pr.roundNumber}</h3>
            <span className="text-xs font-bold text-gold" dir="ltr">
              {pr.prizePool} GRAM
            </span>
          </div>
          {pr.winners.length === 0 ? (
            <p className="text-xs text-muted-foreground">لا يوجد فائزون في هذه الجولة.</p>
          ) : (
            <ul className="space-y-1.5">
              {pr.winners.map((w, idx) => (
                <li key={w.tgId} className="flex items-center justify-between text-xs">
                  <span className="truncate font-semibold text-foreground">
                    {MEDALS[idx] ?? `#${w.rank}`} {w.name}
                  </span>
                  <span className="shrink-0 font-bold text-gold" dir="ltr">
                    +{w.prizeGram} GRAM
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}