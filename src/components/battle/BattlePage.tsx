import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Clock } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { AnimatedEmoji } from "@/components/emoji/AnimatedEmoji";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { useNow } from "@/components/tasks/use-now";
import { HEROES } from "@/components/heroes/heroes-data";
import { COIN, formatAmount } from "@/lib/coin";
import { collectMining, getHeroBoard } from "@/lib/heroes.functions";
import { coinsPerTitan, isUnlocked, pendingCoins, STORAGE_HOURS, titansSlain, totalRate, upgradeErrorMessage } from "@/lib/heroes-model";
import { useTelegramInitData, haptic } from "@/lib/telegram";
import { SegmentVideo } from "./SegmentVideo";
import { MinePassCard } from "@/components/profile/MinePassCard";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { GameAdButtons } from "@/components/game/GameAdButtons";
import { EnergyBar } from "@/components/game/EnergyBar";
import { gameError } from "@/lib/game-model";
import { GrowthPanel } from "@/components/growth/GrowthPanel";

const fmtLeft = (ms: number) => {
  const m = Math.max(0, Math.ceil(ms / 60_000));
  return `${Math.floor(m / 60)}س ${m % 60}د`;
};

export function BattlePage() {
  const qc = useQueryClient();
  const now = useNow(1000);
  const initData = useTelegramInitData();
  const [pops, setPops] = useState<number[]>([]);
  const [collectOpen, setCollectOpen] = useState(false);
  const [adBusy, setAdBusy] = useState(false);
  const [chestOpen, setChestOpen] = useState(false);
  const [passOpen, setPassOpen] = useState(false);

  const fetchBoard = useServerFn(getHeroBoard);
  const board = useQuery({ queryKey: ["wall-heroes", initData], queryFn: () => fetchBoard({ data: { initData } }), enabled: !!initData });
  const b = board.data;
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
  const collect = useMutation({ mutationFn: () => collectFn({ data: { initData } }), onSuccess: (r) => { ok(r.amount); setCollectOpen(false); void qc.invalidateQueries({ queryKey: ["wall-energy"] }); }, onError: (e) => toast.error(e instanceof Error && e.message.includes("no_energy") ? gameError(e) : upgradeErrorMessage(e)) });

  return (
    <main className="relative mx-auto h-[calc(100dvh-3.75rem-var(--tg-safe-top,0px))] max-w-md overflow-hidden">
      {/* Battle footage */}
      {clip ? (
        <SegmentVideo key={clip} src={clip} poster={hero.image} className="absolute inset-x-0 bottom-0 top-36" />
      ) : (
        <img src={hero.image} alt={hero.name} className="absolute inset-x-0 bottom-0 top-36 h-[calc(100%-9rem)] w-full object-cover object-top" />
      )}
      <div className="battle-shade absolute inset-0" />

      {/* Storage header */}
      <header className="glass absolute inset-x-3 top-3 z-10 rounded-3xl px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">غنايم المعركة</p>
            <p className="text-gold text-2xl font-extrabold tabular-nums">{formatAmount(pending)} <span className="text-sm">{COIN.symbol}</span></p>
          </div>
          <Button type="button" disabled={collect.isPending || (miningEnabled && pending <= 0)} onClick={() => miningEnabled ? setCollectOpen(true) : setPassOpen(true)}
            className="btn-cta h-11 shrink-0 rounded-2xl px-5 text-base font-extrabold disabled:opacity-50">{miningEnabled ? "استلام" : "تفعيل التعدين"}</Button>
        </div>
        <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><AnimatedEmoji name="spark" className="size-4 text-accent" />{formatAmount(rate)}/س</span>
          <span className="flex items-center gap-1"><Clock className="size-3.5" />{b && miningEnabled ? (full ? "المخزن مليان" : fmtLeft(b.minedAt + STORAGE_HOURS * 3_600_000 - now)) : "التعدين متوقف"}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="bg-gold-bar h-full rounded-full transition-[width] duration-1000" style={{ width: `${fill * 100}%` }} />
        </div>
        <div className="mt-2.5"><EnergyBar initData={initData} disabled={collect.isPending || adBusy} /></div>
      </header>

      {/* Coin rewards remain visible without covering the battle with a counter. */}
      <div className="absolute inset-x-0 top-[38%] z-10 flex flex-col items-center">
        {pops.map((id) => (
          <span key={id} className="animate-coin-pop text-gold absolute top-12 text-2xl font-extrabold">+{formatAmount(coinsPerTitan(rate))}</span>
        ))}
        {full && <p className="glass mt-2 rounded-full px-3 py-1 text-xs text-destructive">البطل واقف — استلم عشان يكمل القتال</p>}
      </div>

      <section className="absolute inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-10 grid grid-cols-3 gap-2">
        <button type="button" aria-label="صندوق المفاجآت" title="صندوق المفاجآت" onClick={() => setChestOpen(true)} className="glass flex min-w-0 items-center justify-center gap-1.5 rounded-2xl px-2 py-3 text-xs font-extrabold text-foreground transition-transform active:scale-95"><AnimatedEmoji name="crystal" className="size-4 text-accent" /><span>صندوق المفاجآت</span></button>
        <Link to="/duels" aria-label="تحديات الأصدقاء" title="تحديات الأصدقاء" className="glass flex min-w-0 items-center justify-center gap-1.5 rounded-2xl px-2 py-3 text-xs font-extrabold text-foreground transition-transform active:scale-95"><AnimatedEmoji name="shields" className="size-4 text-accent" /><span>التحديات</span></Link>
        <Link to="/heroes" aria-label="فريق الأبطال" title="فريق الأبطال" className="glass flex min-w-0 items-center justify-center gap-1.5 rounded-2xl px-2 py-3 text-xs font-extrabold text-foreground transition-transform active:scale-95"><AnimatedEmoji name="scout" className="size-4 text-accent" /><span>الأبطال</span></Link>
      </section>
      <Dialog open={chestOpen} onOpenChange={setChestOpen}><DialogContent className="max-w-sm"><DialogTitle>صندوق المفاجآت</DialogTitle><DialogDescription>مكافأة كل 8 ساعات</DialogDescription><GrowthPanel mode="chest" /></DialogContent></Dialog>
      <Dialog open={passOpen} onOpenChange={setPassOpen}><DialogContent className="max-w-sm"><DialogTitle>تفعيل التعدين والتوثيق</DialogTitle><DialogDescription>تصريح التعدين · 0.05 TON</DialogDescription><MinePassCard initData={initData} variant="stacked" /></DialogContent></Dialog>

      <Dialog open={collectOpen} onOpenChange={(open) => { if (!adBusy && !collect.isPending) setCollectOpen(open); }}>
        <DialogContent className="max-w-sm" onInteractOutside={(e) => { if (adBusy) e.preventDefault(); }} onEscapeKeyDown={(e) => { if (adBusy) e.preventDefault(); }}>
          <DialogTitle>استلام غنيمة المعركة</DialogTitle>
          <DialogDescription>{formatAmount(pending)} ANIME · استلام 1x أو مضاعفة 2x</DialogDescription>
          <Button variant="outline" disabled={adBusy || collect.isPending} onClick={() => collect.mutate()}>استلام عادي 1x</Button>
          <p className="text-center font-bold text-gold">مضاعفة الغنيمة 2x بإعلان</p>
          <GameAdButtons initData={initData} benefit="double" disabled={collect.isPending} onBusyChange={setAdBusy} onReward={(amount) => { ok(amount); setCollectOpen(false); }} />
        </DialogContent>
      </Dialog>
      <BottomNav />
    </main>
  );
}
