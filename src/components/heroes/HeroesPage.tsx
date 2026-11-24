import { useEffect, useState } from "react";
import { trf } from "@/i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Layers, Lock, Pickaxe, Plus, Zap } from "lucide-react";
import { toast } from "sonner";

import { BottomNav } from "@/components/BottomNav";
import { AnimatedEmoji } from "@/components/emoji/AnimatedEmoji";
import { useNow } from "@/components/tasks/use-now";
import { COIN, formatAmount } from "@/lib/coin";
import { collectMining, getHeroBoard, upgradeHero } from "@/lib/heroes.functions";
import { heroCost, heroRate, isUnlocked, MAX_LEVEL, pendingCoins, STORAGE_HOURS, TOTAL_MAX, totalRate, upgradeErrorMessage } from "@/lib/heroes-model";
import { showRewardedAd } from "@/lib/monetag";
import { adReward, shopErrorMessage } from "@/lib/shop-model";
import { claimAdReward } from "@/lib/shop.functions";
import { useTelegramInitData, haptic } from "@/lib/telegram";
import { cn } from "@/lib/utils";
import { HeroMedia } from "./HeroMedia";
import { HEROES, TIER_SIZE, tierName, tierOf } from "./heroes-data";
import { LevelSheet, type LevelPick } from "./LevelSheet";
import { ShopDrawer } from "./ShopDrawer";
import { MinePassCard } from "@/components/profile/MinePassCard";

const TIERS = Array.from({ length: MAX_LEVEL / TIER_SIZE }, (_, t) => t);

export function HeroesPage() {
  const qc = useQueryClient();
  const now = useNow(1000);
  const initData = useTelegramInitData();
  const [shopOpen, setShopOpen] = useState(false);
  const [pick, setPick] = useState<LevelPick>(null);
  const [view, setView] = useState<number | null>(null);

  const fetchBoard = useServerFn(getHeroBoard);
  const board = useQuery({ queryKey: ["wall-heroes", initData], queryFn: () => fetchBoard({ data: { initData } }), enabled: !!initData });
  const b = board.data;
  const guest = !initData;
  const levels = b?.levels ?? [1, 0, 0, 0, 0];
  const balance = b?.balance ?? 0;
  const rate = totalRate(levels);
  const pending = b ? pendingCoins(rate, b.minedAt, now, !!b.minePass) : 0;
  const fill = b?.minePass ? Math.min(1, (now - b.minedAt) / (STORAGE_HOURS * 3_600_000)) : 0;
  const total = levels.reduce((a, c) => a + c, 0);
  const refresh = () => qc.invalidateQueries({ queryKey: ["wall-heroes"] });
  const ok = (n: number) => { haptic("success"); toast.success(`+${formatAmount(n)} ${COIN.symbol}`); void refresh(); };

  // "My" hero = the highest unlocked one; the page opens on it.
  const mine = levels.reduce((m, _, i) => (isUnlocked(i, levels) ? i : m), 0);
  const h = view ?? mine;
  const hero = HEROES[h]!;
  const hLvl = levels[h] ?? 0;
  const hOpen = isUnlocked(h, levels);
  const myLvl = levels[mine] ?? 0;
  const nextCost = heroCost(mine, myLvl);

  const collectFn = useServerFn(collectMining);
  const collect = useMutation({ mutationFn: () => collectFn({ data: { initData } }), onSuccess: (r) => ok(r.amount), onError: (e) => toast.error(upgradeErrorMessage(e)) });
  const adFn = useServerFn(claimAdReward);
  const ad = useMutation({
    mutationFn: async () => { await showRewardedAd(); return adFn({ data: { initData } }); },
    onSuccess: (r) => ok(r.amount),
    onError: (e) => toast.error(e instanceof Error && e.message === "ad_unavailable" ? "مفيش إعلان متاح دلوقتي، جرب كمان شوية" : shopErrorMessage(e)),
  });
  const upFn = useServerFn(upgradeHero);
  const up = useMutation({
    mutationFn: (hi: number) => upFn({ data: { initData, hero: hi } }),
    onSuccess: (r, hi) => {
      haptic("success");
      toast.success(trf("{hero} بقى مستوى {level}", { hero: HEROES[hi]!.name, level: r.level }));
      setPick((p) => (p && r.level < MAX_LEVEL ? { hero: hi, level: r.level + 1 } : null));
      void refresh();
    },
    onError: (e) => { haptic("error"); toast.error(upgradeErrorMessage(e)); },
  });

  // Auto-upgrade: whenever the balance covers the next level, the current hero levels up by itself (server still checks the price).
  useEffect(() => {
    if (!b || guest || up.isPending || board.isFetching || myLvl >= MAX_LEVEL || balance < nextCost) return;
    up.mutate(mine);
  }, [b, guest, up.isPending, board.isFetching, myLvl, balance, nextCost, mine]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 pb-28 [--main-pt:1rem]">
      {/* Title + balance */}
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-gold text-3xl font-extrabold">فريق الأبطال</h1>
          <p className="mt-1 text-xs text-muted-foreground">{formatAmount(TOTAL_MAX)} مستوى · 5 أبطال. رقّي عشان تعدّن أسرع.</p>
        </div>
        <button type="button" onClick={() => setShopOpen(true)} className="glass flex shrink-0 items-center gap-1.5 rounded-full py-1.5 pe-1.5 ps-3 text-sm font-bold">
          {formatAmount(balance)}
          <span className="btn-cta grid size-6 place-items-center rounded-full"><Plus className="size-4" /></span>
        </button>
      </header>

      {/* My hero card */}
      <section className="glass relative mt-4 flex overflow-hidden rounded-[28px]">
        <div className="min-w-0 flex-1 p-4">
          <p className="text-xs text-muted-foreground">بطلي</p>
          <p className="text-gold truncate text-2xl font-extrabold">{tierName(mine, tierOf(Math.max(1, myLvl)))}</p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
            <span className="glass-card rounded-full px-2.5 py-1">⭐ مستوى {myLvl}</span>
            <span className="glass-card flex items-center gap-1 rounded-full px-2.5 py-1"><Zap className="size-3" />{formatAmount(rate)}/س</span>
          </div>
          {myLvl < MAX_LEVEL && (
            <>
              <div className="mt-3 flex justify-between text-xs">
                <span>التالي: مستوى {myLvl + 1}</span>
                <span className="font-bold">{formatAmount(balance)} / {formatAmount(nextCost)}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                <div className="bg-gold-bar h-full rounded-full" style={{ width: `${Math.min(100, (balance / nextCost) * 100)}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {balance >= nextCost ? "بيترقّى تلقائيًا… ⚡" : `باقي ${formatAmount(nextCost - balance)} ${COIN.symbol} ويترقّى تلقائيًا`}
              </p>
            </>
          )}
        </div>
        <div className="relative w-32 shrink-0"><HeroMedia hero={HEROES[mine]!} /></div>
      </section>

      {/* Mining storage */}
      {!b?.minePass && <div className="mt-3"><MinePassCard initData={initData} /></div>}
      <section className="glass-card mt-3 rounded-3xl p-3">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">المخزن ({STORAGE_HOURS} ساعات)</p>
            <p className="text-lg font-extrabold">{formatAmount(pending)} <span className="text-xs">{COIN.symbol}</span></p>
          </div>
          <button type="button" disabled={guest || ad.isPending} onClick={() => ad.mutate()}
            className="glass flex items-center gap-1 rounded-2xl px-3 py-2 text-xs font-semibold disabled:opacity-50">
            <AnimatedEmoji name="rocket" className="size-4 text-accent" />+{formatAmount(adReward(rate))}
          </button>
          <button type="button" disabled={guest || collect.isPending || pending <= 0} onClick={() => collect.mutate()}
            className="btn-cta rounded-2xl px-4 py-2 text-sm font-bold disabled:opacity-50">اجمع</button>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="bg-gold-bar h-full rounded-full" style={{ width: `${fill * 100}%` }} />
        </div>
        {fill >= 1 && <p className="mt-1.5 text-xs text-destructive">المخزن مليان والتعدين واقف — اجمع دلوقتي</p>}
      </section>

      {/* Hero ranks */}
      <h2 className="mb-3 mt-6 text-xl font-extrabold">رتب الأبطال</h2>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
        {HEROES.map((x, i) => {
          const open = isUnlocked(i, levels);
          return (
            <button key={x.name} type="button" onClick={() => setView(i)} className="flex w-[84px] shrink-0 flex-col items-center gap-1.5">
              <span className={cn("relative size-[76px] rounded-full p-[3px]", i === h ? "bg-gold-bar" : "bg-muted")}>
                <span className="block size-full overflow-hidden rounded-full">
                  <img src={x.image} alt={x.name} width={768} height={1024} className={cn("size-full object-cover object-top", !open && "grayscale brightness-50")} />
                </span>
                {!open && <span className="glass absolute -bottom-1 start-0 grid size-7 place-items-center rounded-full"><Lock className="size-3.5" /></span>}
                {i === mine && <span className="btn-cta absolute -bottom-1 end-0 rounded-full px-2 text-[10px] font-bold">أنت</span>}
              </span>
              <span className={cn("text-sm font-bold", i === h && "text-gold")}>{x.name}</span>
              <span className="text-[11px] text-muted-foreground">مستوى {i * MAX_LEVEL + 1}-{(i + 1) * MAX_LEVEL}</span>
            </button>
          );
        })}
      </div>

      {/* Selected hero banner */}
      <section className="glass mt-3 overflow-hidden rounded-[28px]">
        <div className="relative h-60">
          <HeroMedia hero={hero} dim={!hOpen} />
          <div className="hero-fade absolute inset-0" />
          <span className="glass absolute end-3 top-3 flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold">
            <Layers className="size-3.5" /> مستوى {h * MAX_LEVEL + 1}-{(h + 1) * MAX_LEVEL}
          </span>
          <div className="absolute inset-x-4 bottom-3">
            <p className="text-3xl font-extrabold">{hero.name}</p>
            <p className="text-gold text-sm font-bold">{hero.title}</p>
          </div>
        </div>
        <div className="p-4">
          <p className="text-xs text-muted-foreground">
            من {formatAmount(heroRate(h, 1))} لحد {formatAmount(heroRate(h, MAX_LEVEL))} {COIN.symbol} في الساعة
          </p>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="bg-gold-bar h-full rounded-full" style={{ width: `${(hLvl / MAX_LEVEL) * 100}%` }} />
            </div>
            <span className="text-xs">تم فتح {hLvl}/{MAX_LEVEL}</span>
          </div>
          {!hOpen && <p className="mt-2 text-xs text-muted-foreground">بيتفتح لما {HEROES[h - 1]!.name} يوصل مستوى {MAX_LEVEL}</p>}
        </div>
      </section>

      {/* Career path */}
      <h2 className="mt-6 text-xl font-extrabold">المسار</h2>
      <p className="mb-3 text-xs text-muted-foreground">دوس على أي مستوى عشان تشوف هيديك إيه</p>
      <ol className="relative space-y-3">
        {TIERS.map((t) => {
          const first = t * TIER_SIZE + 1;
          const last = first + TIER_SIZE - 1;
          const done = hLvl >= last;
          const current = hOpen && !done && hLvl + 1 >= first;
          return (
            <li key={t} className="flex items-stretch gap-2.5">
              <div className={cn("relative flex w-full flex-col rounded-3xl p-3", current ? "glass ring-2 ring-success" : "glass-card", !done && !current && "opacity-70")}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-gold text-lg font-extrabold">{tierName(h, t)}</p>
                    <p className="text-xs text-muted-foreground">{formatAmount(heroRate(h, first))}–{formatAmount(heroRate(h, last))}/س</p>
                  </div>
                  {done ? (
                    <span className="glass rounded-full px-2.5 py-1 text-xs text-gold"><Check className="inline size-3" /> مفتوح</span>
                  ) : current ? (
                    <span className="rounded-full bg-success px-2.5 py-1 text-xs font-bold text-background"><Pickaxe className="inline size-3" /> بيعدّن</span>
                  ) : (
                    <span className="glass rounded-full px-2.5 py-1 text-xs"><Lock className="inline size-3" /> {formatAmount(heroCost(h, first - 1))}</span>
                  )}
                </div>
                <div className="mt-2.5 grid grid-cols-10 gap-1">
                  {Array.from({ length: TIER_SIZE }, (_, k) => first + k).map((n) => (
                    <button key={n} type="button" onClick={() => setPick({ hero: h, level: n })}
                      className={cn("rounded-lg py-1.5 text-[11px] font-bold",
                        n <= hLvl ? "bg-gold-bar text-primary-foreground" : n === hLvl + 1 && hOpen ? "ring-2 ring-accent" : "bg-muted text-muted-foreground",
                        n === hLvl && "ring-2 ring-success")}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Leaderboard */}
      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xl font-extrabold">المتصدرين</h2>
          {b && <span className="glass rounded-full px-3 py-1 text-xs">ترتيبك #{b.rank} · {total} مستوى</span>}
        </div>
        <ol className="glass-card divide-y divide-border rounded-3xl">
          {(b?.leaders ?? []).slice(0, 10).map((l, i) => (
            <li key={i} className={cn("flex items-center gap-3 px-4 py-2.5", l.me && "bg-accent/10")}>
              <span className={cn("w-5 text-center font-bold", i < 3 && "text-gold")}>{i + 1}</span>
              {l.photo ? <img src={l.photo} alt="" className="size-8 rounded-full" /> : <div className="size-8 rounded-full bg-muted" />}
              <span className="flex-1 truncate text-sm">{l.name}</span>
              <span className="text-sm font-bold">{l.total}</span>
            </li>
          ))}
          {guest && <li className="p-4 text-center text-sm text-muted-foreground">افتح اللعبة من تيليجرام عشان تشوف الترتيب</li>}
        </ol>
      </section>

      <LevelSheet pick={pick} onClose={() => setPick(null)} levels={levels} unlocked={pick ? isUnlocked(pick.hero, levels) : false}
        balance={balance} busy={up.isPending || guest} onUpgrade={(hi) => up.mutate(hi)} onShop={() => { setPick(null); setShopOpen(true); }} />
      <ShopDrawer open={shopOpen} onOpenChange={setShopOpen} initData={initData} onPaid={() => void refresh()} />
      <BottomNav />
    </main>
  );
}
