import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BottomNav } from "@/components/BottomNav";
import { AnimatedEmoji } from "@/components/emoji/AnimatedEmoji";
import { Button } from "@/components/ui/button";
import { ShopDrawer } from "@/components/heroes/ShopDrawer";
import { useNow } from "@/components/tasks/use-now";
import { COIN, formatAmount } from "@/lib/coin";
import { getHeroBoard } from "@/lib/heroes.functions";
import { pendingCoins, totalRate, TOTAL_MAX } from "@/lib/heroes-model";
import { getMyBoard, saveWallet } from "@/lib/tasks.functions";
import { useTelegramInitData } from "@/lib/telegram";
import { getTonConnect, shortTonAddress } from "@/lib/ton-connect";
import vaultImage from "@/assets/onboarding/v3-2-mine.jpg";
import { AnimeCard } from "./AnimeCard";
import { MinePassCard } from "@/components/profile/MinePassCard";

export function WalletPage() {
  const initData = useTelegramInitData();
  const [address, setAddress] = useState<string | null>(null);
  const [shortAddress, setShortAddress] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const now = useNow(1000);
  const qc = useQueryClient();
  const heroFn = useServerFn(getHeroBoard);
  const playerFn = useServerFn(getMyBoard);
  const saveFn = useServerFn(saveWallet);
  const board = useQuery({ queryKey: ["wall-heroes", initData], queryFn: () => heroFn({ data: { initData } }), enabled: !!initData });
  const player = useQuery({ queryKey: ["wall-board", initData], queryFn: () => playerFn({ data: { initData } }), enabled: !!initData });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["wall-heroes"] });
    void qc.invalidateQueries({ queryKey: ["wall-board"] });
  };
  useEffect(() => {
    let alive = true;
    let unsubscribe: (() => void) | undefined;
    void getTonConnect().then((ui) => {
      if (!alive) return;
      const update = (raw: string | null) => {
        if (!alive) return;
        setAddress(raw);
        if (!raw) { setShortAddress(""); return; }
        void shortTonAddress(raw).then((short) => { if (alive) setShortAddress(short); });
      };
      update(ui.account?.address ?? null);
      unsubscribe = ui.onStatusChange((wallet) => {
        const raw = wallet?.account.address ?? null;
        update(raw);
        if (raw && initData) void saveFn({ data: { initData, address: raw } }).then(refresh).catch(() => toast.error("تعذّر حفظ عنوان المحفظة"));
      });
    }).catch(() => { if (alive) toast.error("تعذّر تحميل ربط المحفظة"); });
    return () => { alive = false; unsubscribe?.(); };
  }, [initData, saveFn]);

  async function connect() {
    setConnecting(true);
    try { await (await getTonConnect()).openModal(); }
    catch { toast.error("تعذّر فتح المحفظة، جرّب تاني"); }
    finally { setConnecting(false); }
  }
  async function disconnect() {
    try { await (await getTonConnect()).disconnect(); }
    catch { toast.error("تعذّر فصل المحفظة"); }
  }
  async function copy() {
    if (!address) return;
    try {
      const { toUserFriendlyAddress } = await import("@tonconnect/ui");
      await navigator.clipboard.writeText(toUserFriendlyAddress(address));
      toast.success("تم نسخ عنوان المحفظة");
    } catch { toast.error("تعذّر نسخ العنوان"); }
  }

  const b = board.data;
  const rate = b ? totalRate(b.levels) : 0;
  const pending = b ? pendingCoins(rate, b.minedAt, now, !!b.minePass) : 0;
  const total = b?.levels.reduce((sum, level) => sum + level, 0) ?? 0;
  const balance = b?.balance;
  const loading = !!initData && (board.isPending || player.isPending);

  return <main className="relative mx-auto min-h-dvh max-w-md pb-28">
    <div className="absolute inset-x-0 top-0 h-80 overflow-hidden" aria-hidden="true">
      <img src={vaultImage} alt="" className="size-full object-cover object-[center_44%]" />
      <div className="wallet-shade absolute inset-0" />
    </div>
    <div className="relative px-4 pt-10">
      <header className="mb-5 flex items-center justify-between">
        <div><p className="text-xs font-semibold text-muted-foreground">خزينة الحامية</p><h1 className="mt-1 text-3xl font-extrabold">المحفظة</h1></div>
        <AnimatedEmoji name="wallet" className="size-12 text-accent" />
      </header>

      <section className="wallet-surface rounded-3xl p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-foreground/80">رصيدك داخل اللعبة</p>
          <span className="text-xs font-bold text-success">{COIN.symbol}</span>
        </div>
        <p className="mt-3 break-words text-4xl font-extrabold tabular-nums">{balance === undefined ? "—" : formatAmount(balance)}</p>
        <p className="mt-2 text-sm text-foreground/80">المستوى {b ? total : "—"} <span className="text-xs">/ {TOTAL_MAX}</span></p>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-background/30"><div className="h-full origin-right rounded-full bg-success" style={{ width: `${total / TOTAL_MAX * 100}%` }} /></div>
        <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-foreground/15 pt-4">
          <div><dt className="text-xs text-foreground/70">غنايم لم تُستلم</dt><dd className="mt-1 text-xl font-bold tabular-nums">{b ? formatAmount(pending) : "—"}</dd></div>
          <div className="border-s border-foreground/15 ps-4"><dt className="text-xs text-foreground/70">قوة التعدين / ساعة</dt><dd className="mt-1 text-xl font-bold tabular-nums">{b ? formatAmount(rate) : "—"}</dd></div>
        </dl>
      </section>
      {!initData && <p className="mt-3 text-center text-xs text-muted-foreground">افتح اللعبة من تيليجرام لعرض رصيدك</p>}
      {loading && <p role="status" className="mt-3 text-xs text-muted-foreground">جارٍ تحديث الرصيد…</p>}
      {(board.isError || player.isError) && <div role="alert" className="mt-3 flex items-center justify-between text-sm"><span>تعذّر تحميل الرصيد</span><Button variant="outline" onClick={refresh}>إعادة المحاولة</Button></div>}

      <section className="mt-6">
        <h2 className="mb-3 text-xl font-extrabold">محفظة TON</h2>
        <div className="glass flex items-center gap-3 rounded-3xl p-4">
          <AnimatedEmoji name="ton" className="size-11 shrink-0 text-chart-2" />
          <div className="min-w-0 flex-1"><p className="font-bold">{address ? "متصلة" : "غير متصلة"}</p>
            {address ? <Button variant="ghost" onClick={copy} title="نسخ العنوان" className="h-auto max-w-full px-0 py-1 text-muted-foreground"><span dir="ltr" className="truncate">{shortAddress || "…"}</span><span aria-hidden="true">⧉</span></Button> : <p className="mt-1 text-xs text-muted-foreground">TON</p>}
          </div>
          {address ? <Button variant="outline" size="icon" title="فصل المحفظة" aria-label="فصل المحفظة" onClick={disconnect}>↪</Button> : <Button onClick={connect} disabled={connecting} className="btn-cta rounded-xl">{connecting ? "…" : "ربط المحفظة"}</Button>}
        </div>
      </section>

      <div className="mt-6"><MinePassCard initData={initData} /></div>

      <section className="mt-6">
        <h2 className="mb-3 text-xl font-extrabold">شراء العملات</h2>
        <Button variant="ghost" onClick={() => setShopOpen(true)} className="tile-gold h-auto w-full justify-between rounded-3xl p-5 text-primary-foreground">
          <span className="flex flex-col items-start gap-1"><span className="text-lg font-extrabold">اشحن {COIN.symbol}</span><span className="text-xs">الدفع بـ TON</span></span>
          <AnimatedEmoji name="gem" className="size-10" />
        </Button>
      </section>
      <AnimeCard initData={initData} address={address} />

      <section className="mt-6">
        <h2 className="mb-3 text-xl font-extrabold">مكافآت الحامية</h2>
        <div className="glass-card rounded-3xl p-5">
          <p className="text-sm text-muted-foreground">مكافآت الحضور هذا الأسبوع</p>
          <p className="mt-2 text-3xl font-extrabold text-gold">{player.data ? formatAmount(player.data.player.weekEarned) : "—"} <span className="text-sm">{COIN.symbol}</span></p>
          <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-4">
            <div className="flex items-center gap-2"><AnimatedEmoji name="spark" className="size-7 text-accent" /><div><dt className="text-xs text-muted-foreground">حضور متواصل</dt><dd className="font-bold">{player.data?.player.streak ?? "—"} يوم</dd></div></div>
            <div className="flex items-center gap-2"><AnimatedEmoji name="scout" className="size-7 text-success" /><div><dt className="text-xs text-muted-foreground">إحالاتك</dt><dd className="font-bold">{player.data?.player.referrals ?? "—"}</dd></div></div>
          </dl>
        </div>
      </section>
    </div>
    <ShopDrawer open={shopOpen} onOpenChange={setShopOpen} initData={initData} onPaid={refresh} />
    <BottomNav />
  </main>;
}