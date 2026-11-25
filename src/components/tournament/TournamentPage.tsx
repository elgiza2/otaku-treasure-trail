import { useState } from "react";
import { queryOptions, useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Clock, Copy, Loader2, Share2, ShieldCheck, Trophy } from "lucide-react";
import { toast } from "sonner";

import hallImage from "@/assets/tasks/garrison-hall.jpg";
import { BottomNav } from "@/components/BottomNav";
import { AnimatedEmoji } from "@/components/emoji/AnimatedEmoji";
import { MinePassCard } from "@/components/profile/MinePassCard";
import { useNow } from "@/components/tasks/use-now";
import { Button } from "@/components/ui/button";
import { showAdsgramAd } from "@/lib/adsgram";
import { COIN, formatAmount, referralLink } from "@/lib/coin";
import { showRewardedAd } from "@/lib/monetag";
import { claimAdReward } from "@/lib/shop.functions";
import { AD_MIN_REWARD, shopErrorMessage } from "@/lib/shop-model";
import { haptic, shareLink, useTelegramInitData } from "@/lib/telegram";
import { getMyTournamentStatus, getTournamentBoard } from "@/lib/tournament.functions";
import {
  formatCountdown,
  TOURNAMENT_AD_POINTS,
  TOURNAMENT_REFERRAL_POINTS,
  TOURNAMENT_VERIFY_TON,
  type AdProvider,
} from "@/lib/tournament-model";
import { cn } from "@/lib/utils";
import { TournamentHistoryView, TournamentLeadersView, TournamentPrizesView } from "./TournamentLeaderboard";
import { useTranslationReady } from "@/i18n/DomTranslator";

export const tournamentQuery = queryOptions({
  queryKey: ["wall-tournament"],
  queryFn: () => getTournamentBoard(),
  refetchInterval: 30_000,
});

const GUEST_MSG = "افتح اللعبة من تيليجرام للمشاركة في المسابقة";

export function TournamentPage() {
  const translationReady = useTranslationReady();
  const qc = useQueryClient();
  const now = useNow(1000);
  const initData = useTelegramInitData();
  const [tab, setTab] = useState<"leaders" | "prizes" | "history">("leaders");
  const [busyProvider, setBusyProvider] = useState<AdProvider | null>(null);

  const { data: board } = useSuspenseQuery(tournamentQuery);
  const fetchMine = useServerFn(getMyTournamentStatus);
  const mine = useQuery({
    queryKey: ["wall-tournament-me", initData],
    queryFn: () => fetchMine({ data: { initData } }),
    enabled: initData.length > 0,
  });
  const me = mine.data ?? null;

  const adFn = useServerFn(claimAdReward);
  const watchAd = useMutation({
    mutationFn: async (provider: AdProvider) => {
      setBusyProvider(provider);
      if (provider === "adsgram") await showAdsgramAd();
      else await showRewardedAd();
      return adFn({ data: { initData, provider } });
    },
    onSuccess: (r) => {
      haptic("success");
      toast.success(`+${TOURNAMENT_AD_POINTS} نقطة مسابقة`, {
        description: `و +${formatAmount(r.amount)} ${COIN.symbol}`,
      });
      void qc.invalidateQueries({ queryKey: ["wall-tournament"] });
      void qc.invalidateQueries({ queryKey: ["wall-tournament-me"] });
      void qc.invalidateQueries({ queryKey: ["wall-board"] });
    },
    onError: (e) => {
      haptic("error");
      const msg = e instanceof Error ? e.message : "";
      if (msg === "ad_unavailable") toast.error("مفيش إعلان متاح على الشبكة دي دلوقتي، جرّب الشبكة التانية");
      else if (msg === "ad_skipped") toast.error("لازم تكمل مشاهدة الإعلان عشان تاخد النقاط");
      else toast.error(shopErrorMessage(e));
    },
    onSettled: () => setBusyProvider(null),
  });

  const link = me ? referralLink(me.tgId) : "";
  const endsAtMs = new Date(board.round.endsAt).getTime();
  const countdown = now ? formatCountdown(endsAtMs, now) : "…";

  async function copyRef() {
    if (!link) {
      toast(GUEST_MSG);
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      toast.success("تم نسخ رابط الدعوة");
    } catch {
      toast.error("تعذّر نسخ الرابط");
    }
  }

  function inviteFriend() {
    if (!link) {
      toast(GUEST_MSG);
      return;
    }
    shareLink(link, `انضم لمسابقة الـ ${board.round.prizePool} GRAM في منجم الأسوار ووثّق حسابك لنربح معاً!`);
  }

  function triggerAd(provider: AdProvider) {
    if (!initData) {
      toast(GUEST_MSG);
      return;
    }
    watchAd.mutate(provider);
  }

  return (
    <main data-translation-pending={translationReady ? undefined : ""} className="relative mx-auto min-h-dvh w-full max-w-md overflow-x-hidden bg-background pb-28">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[24rem] overflow-hidden" aria-hidden="true">
        <img src={hallImage} alt="" width={720} height={1271} className="size-full object-cover object-top" />
        <div className="hero-fade absolute inset-0" />
      </div>

      <div className="relative px-4 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <header className="flex flex-col items-center pt-10 text-center">
          <span className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-accent">
            <Trophy className="size-3.5" /> الجولة #{board.round.roundNumber} · كل أسبوع
          </span>
          <h1 className="mt-2 font-display text-4xl font-extrabold text-gold drop-shadow-lg">مسابقة GRAM</h1>
          <p className="mt-1 text-sm font-semibold text-foreground/85">
            مجموع الجوائز <span dir="ltr" className="text-gold">{board.round.prizePool} GRAM</span> لأفضل 20 لاعب
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <span className="glass inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold text-foreground">
              <Clock className="size-3.5 text-accent" /> ينتهي خلال: <span dir="ltr" className="tabular-nums text-gold">{countdown}</span>
            </span>
            {me && (
              <span className="glass inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold text-foreground">
                رصيدك: <span dir="ltr" className="text-gold">{formatAmount(me.gramBalance)} GRAM</span>
              </span>
            )}
          </div>
        </header>

        {/* My tournament standing */}
        {me && (
          <section className="wallet-surface mt-5 rounded-3xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-foreground/75">نقاطك في الجولة</p>
                <p className="font-display text-3xl font-extrabold tabular-nums text-gold" dir="ltr">
                  {formatAmount(me.points)} <span className="text-xs font-semibold text-foreground/80">نقطة</span>
                </p>
              </div>
              <div className="text-end">
                <p className="text-xs text-foreground/75">ترتيبك</p>
                <p className="font-display text-2xl font-extrabold tabular-nums text-foreground" dir="ltr">
                  {me.rank ? `#${me.rank}` : "—"}
                </p>
                {me.projectedPrize > 0 && (
                  <p className="text-xs font-bold text-gold" dir="ltr">
                    جائزة متوقعة: {me.projectedPrize} GRAM
                  </p>
                )}
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-foreground/15 pt-2.5 text-xs text-foreground/80">
              <span>{me.adsCount} إعلان · {me.referralsCount} إحالة موثقة</span>
              <span className="inline-flex items-center gap-1 font-semibold">
                <ShieldCheck className={cn("size-3.5", me.isVerified ? "text-success" : "text-muted-foreground")} />
                {me.isVerified ? "حسابك موثّق" : "غير موثّق"}
              </span>
            </div>
          </section>
        )}

        {/* Dual Ad Networks (Adsgram + Monetag simultaneously, unlimited) */}
        <section className="glass-card mt-4 rounded-3xl p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-extrabold text-foreground">اتفرج على إعلان (+{TOURNAMENT_AD_POINTS} نقاط)</h2>
            <span className="rounded-full bg-background/50 px-2 py-0.5 text-[0.68rem] text-muted-foreground">بلا حد</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            شبكتان شغالين مع بعض — كل إعلان يديك +{TOURNAMENT_AD_POINTS} نقاط و +{AD_MIN_REWARD} {COIN.symbol}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <Button
              type="button"
              disabled={watchAd.isPending}
              onClick={() => triggerAd("adsgram")}
              className="btn-cta h-12 rounded-2xl text-sm font-extrabold"
            >
              {busyProvider === "adsgram" ? <Loader2 className="size-4 animate-spin" /> : "إعلان Adsgram"}
            </Button>
            <Button
              type="button"
              disabled={watchAd.isPending}
              onClick={() => triggerAd("monetag")}
              className="btn-cta h-12 rounded-2xl text-sm font-extrabold"
            >
              {busyProvider === "monetag" ? <Loader2 className="size-4 animate-spin" /> : "إعلان Monetag"}
            </Button>
          </div>
        </section>

        {/* Verified Referral Action */}
        <section className="glass-card mt-3 rounded-3xl p-4">
          <div className="flex items-center gap-2.5">
            <AnimatedEmoji name="scout" className="size-8 shrink-0 text-accent" />
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-base font-extrabold text-foreground">
                ادعُ صديقاً (+{TOURNAMENT_REFERRAL_POINTS} نقطة)
              </h2>
              <p className="text-xs text-muted-foreground">
                تُحتسب الإحالة تلقائياً بعد توثيق الصديق لحسابه بـ {TOURNAMENT_VERIFY_TON} TON
              </p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button type="button" onClick={inviteFriend} className="btn-cta h-11 flex-1 rounded-xl font-bold">
              <Share2 className="size-4" /> مشاركة الرابط
            </Button>
            <Button type="button" variant="outline" size="icon" onClick={copyRef} aria-label="نسخ رابط الدعوة" className="h-11 w-11 shrink-0 rounded-xl">
              <Copy className="size-4" />
            </Button>
          </div>
        </section>

        {/* Verification card if not verified */}
        {me && !me.isVerified && (
          <div className="mt-3">
            <MinePassCard initData={initData} variant="stacked" />
          </div>
        )}

        {/* Tabs */}
        <div role="tablist" aria-label="أقسام المسابقة" className="mt-5 grid grid-cols-3 gap-1 rounded-2xl bg-muted/50 p-1">
          {(
            [
              ["leaders", `المتصدرون (${board.participantsCount})`],
              ["prizes", "الجوائز"],
              ["history", "السابق"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn(
                "rounded-xl py-2 text-xs font-bold transition-colors",
                tab === id ? "btn-cta" : "text-muted-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <section className="mt-4">
          {tab === "leaders" && <TournamentLeadersView leaders={board.leaders} myTgId={me?.tgId ?? null} />}
          {tab === "prizes" && <TournamentPrizesView />}
          {tab === "history" && <TournamentHistoryView pastRounds={board.pastRounds} />}
        </section>
      </div>
      <BottomNav />
    </main>
  );
}