import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Clock, Zap } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { AnimatedEmoji } from "@/components/emoji/AnimatedEmoji";
import { useNow } from "@/components/tasks/use-now";
import { HEROES } from "@/components/heroes/heroes-data";
import { COIN, formatAmount } from "@/lib/coin";
import { collectMining, getHeroBoard } from "@/lib/heroes.functions";
import { coinsPerTitan, isUnlocked, pendingCoins, STORAGE_HOURS, titansSlain, totalRate, upgradeErrorMessage } from "@/lib/heroes-model";
import { useTelegramInitData, haptic } from "@/lib/telegram";
import { SegmentVideo } from "./SegmentVideo";
import { MinePassCard } from "@/components/profile/MinePassCard";

const fmtLeft = (ms: number) => {
  const m = Math.max(0, Math.ceil(ms / 60_000));
  return `${Math.floor(m / 60)}س ${m % 60}د`;
};

export function BattlePage() {
  const qc = useQueryClient();
  const now = useNow(1000);
  const initData = useTelegramInitData();
  const [pops, setPops] = useState<number[]>([]);

  const fetchBoard = useServerFn(getHeroBoard);
  const board = useQuery({ queryKey: ["wall-heroes", initData], queryFn: () => fetchBoard({ data: { initData } }), enabled: !!initData });
  const b = board.data;
  const guest = !initData;
  const levels = b?.levels ?? [1, 0, 0, 0, 0];
  const rate = totalRate(levels);
  const miningEnabled = !!b?.minePass;
  const pending = b ? pendingCoins(rate, b.minedAt, now, miningEnabled) : 0;
  const kills = b ? titansSlain(b.minedAt, now, miningEnabled) : 0;
  const full = b && miningEnabled ? now - b.minedAt >= STORAGE_HOURS * 3_600_000 : false;
  const fill = b && miningEnabled ? Math.min(1, (now - b.minedAt) / (STORAGE_HOURS * 3_600_000)) : 0;

  const mine = levels.reduce((m, _, i) => (isUnlocked(i, levels) ? i : m), 0);
  const hero = HEROES[mine] ?? HEROES[0];
  if (!hero) return null;
  const clip = hero.battle ?? hero.video;

  // A "+coins" pop every time a new titan falls.
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (!b) return;
    if (last.current !== null && kills > last.current) {
      const id = Date.now();
      setPops((p) => [...p.slice(-3), id]);
      haptic("success");
      setTimeout(() => setPops((p) => p.filter((x) => x !== id)), 1600);
    }
    last.current = kills;
  }, [kills, b]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["wall-heroes"] });
  const ok = (n: number) => { haptic("success"); toast.success(`+${formatAmount(n)} ${COIN.symbol}`); last.current = 0; void refresh(); };
  const collectFn = useServerFn(collectMining);
  const collect = useMutation({ mutationFn: () => collectFn({ data: { initData } }), onSuccess: (r) => ok(r.amount), onError: (e) => toast.error(upgradeErrorMessage(e)) });

  return (
    <main className="relative mx-auto h-dvh max-w-md overflow-hidden">
      {/* Battle footage */}
      {clip ? (
        <SegmentVideo key={clip} src={clip} poster={hero.image} className="absolute inset-0 size-full" />
      ) : (
        <img src={hero.image} alt={hero.name} className="absolute inset-0 size-full object-cover" />
      )}
      <div className="battle-shade absolute inset-0" />

      {/* Storage header */}
      <header className="glass absolute inset-x-3 top-[calc(var(--tg-safe-top,0px)+0.75rem)] z-10 rounded-[26px] p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">غنايم المعركة</p>
            <p className="text-gold text-3xl font-extrabold tabular-nums">{formatAmount(pending)} <span className="text-sm">{COIN.symbol}</span></p>
          </div>
          <Button type="button" disabled={guest || collect.isPending || pending <= 0} onClick={() => collect.mutate()}
            className="btn-cta h-auto shrink-0 rounded-2xl px-6 py-3 text-lg font-extrabold disabled:opacity-50">استلام</Button>
        </div>
        <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Zap className="size-3.5" />{formatAmount(rate)}/س</span>
          <span className="flex items-center gap-1"><Clock className="size-3.5" />{b && miningEnabled ? (full ? "المخزن مليان" : fmtLeft(b.minedAt + STORAGE_HOURS * 3_600_000 - now)) : "التعدين متوقف"}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="bg-gold-bar h-full rounded-full transition-[width] duration-1000" style={{ width: `${fill * 100}%` }} />
        </div>
      </header>

      {/* Coin rewards remain visible without covering the battle with a counter. */}
      <div className="absolute inset-x-0 top-[38%] z-10 flex flex-col items-center">
        {pops.map((id) => (
          <span key={id} className="animate-coin-pop text-gold absolute top-12 text-2xl font-extrabold">+{formatAmount(coinsPerTitan(rate))}</span>
        ))}
        {full && <p className="glass mt-2 rounded-full px-3 py-1 text-xs text-destructive">البطل واقف — استلم عشان يكمل القتال</p>}
      </div>

      {/* Tournament + NFT entry + Mine Pass */}
      <section className="absolute inset-x-3 bottom-24 z-10 space-y-2">
        <Link to="/tournament" className="glass flex items-center gap-3 rounded-2xl px-4 py-3">
          <AnimatedEmoji name="sparkle" className="size-8 shrink-0 text-accent" />
          <span className="min-w-0 flex-1">
            <span className="block font-display text-base font-extrabold text-gold">مسابقة 350 GRAM</span>
            <span className="block text-xs text-muted-foreground">كل 3 أيام · إعلانات وإحالات موثقة</span>
          </span>
          <span className="btn-cta shrink-0 rounded-xl px-4 py-2 text-sm font-extrabold">دخول</span>
        </Link>
        <Link to="/nft" className="glass flex items-center gap-3 rounded-2xl px-4 py-3">
          <AnimatedEmoji name="gem" className="size-8 shrink-0 text-accent" />
          <span className="min-w-0 flex-1">
            <span className="block font-display text-base font-extrabold">NFT الحرب</span>
            <span className="block text-xs text-muted-foreground">اعمل Mint وخد بطاقة عشوائية</span>
          </span>
          <span className="btn-cta shrink-0 rounded-xl px-4 py-2 text-sm font-extrabold">Mint</span>
        </Link>
        {!miningEnabled && <MinePassCard initData={initData} variant="stacked" />}
      </section>

      <BottomNav />
    </main>
  );
}
