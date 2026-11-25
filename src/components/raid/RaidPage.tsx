import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Shield, Swords } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { AnimatedEmoji } from "@/components/emoji/AnimatedEmoji";
import { BottomNav } from "@/components/BottomNav";
import { COIN, formatAmount } from "@/lib/coin";
import { getRaidState, spinRaid } from "@/lib/raid.functions";
import { MAX_FREE_SPINS, SPIN_PACKS, VAULT_KEYS, WHEEL, type SpinResult } from "@/lib/raid-model";
import { checkTonPayment, createTonPayment } from "@/lib/shop.functions";
import { shopErrorMessage } from "@/lib/shop-model";
import { useTelegramInitData, haptic } from "@/lib/telegram";
import { getTonConnect } from "@/lib/ton-connect";
import { cn } from "@/lib/utils";
import { StarField } from "@/components/nft/NftIntro";
import { StoryGame } from "@/components/story/StoryGame";
import { AnimeNovel } from "@/components/story/AnimeNovel";
import { GameAdButtons } from "@/components/game/GameAdButtons";
import { EnergyBar } from "@/components/game/EnergyBar";
import { gameError } from "@/lib/game-model";
import { Link } from "@tanstack/react-router";

function resultText(r: SpinResult): string {
  switch (r.segment) {
    case "gram": return `كسبت ${r.amount} GRAM!`;
    case "coins": case "jackpot_coins": return `كسبت ${formatAmount(r.amount)} ${COIN.symbol}`;
    case "shield": return r.amount > 0 ? `دروعك مليانة، خد ${formatAmount(r.amount)} بدالها` : "خدت درع يحمي سورك";
    case "key": return "خدت مفتاح للخزينة!";
    case "vault": return `فتحت الخزينة! كسبت ${formatAmount(r.amount)} ${COIN.symbol}`;
    case "raid": return r.blocked ? `الدرع صد غارتك، خدت ${formatAmount(r.amount)}` : `غارة ناجحة! سرقت ${formatAmount(r.amount)} ${COIN.symbol}`;
  }
}

export function RaidPage() {
  const qc = useQueryClient();
  const initData = useTelegramInitData();
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"novel" | "riddle" | "raid">("novel");

  const stateFn = useServerFn(getRaidState);
  const spinFn = useServerFn(spinRaid);
  const createFn = useServerFn(createTonPayment);
  const checkFn = useServerFn(checkTonPayment);
  const q = useQuery({ queryKey: ["wall-raid", initData], queryFn: () => stateFn({ data: { initData } }), enabled: !!initData, refetchInterval: 30_000 });
  const s = q.data;

  async function spin(revenge?: number) {
    if (!initData) { toast("افتح اللعبة من تيليجرام عشان تلف"); return; }
    if (spinning) return;
    setSpinning(true); setResult(null);
    try {
      const r = await spinFn({ data: { initData, ...(revenge ? { revenge } : {}) } });
      const seg = r.segment === "vault" ? "key" : r.segment;
      const idx = Math.max(0, WHEEL.findIndex((w) => w.seg === seg));
      setAngle((a) => a - (a % 360) + 360 * 5 + (360 - idx * 45));
      await new Promise((res) => setTimeout(res, 3300));
      setResult(r); haptic("success");
      void qc.invalidateQueries({ queryKey: ["wall-energy"] });
      void qc.invalidateQueries({ queryKey: ["wall-tournament-me"] });
      await q.refetch();
    } catch (e) { toast.error(e instanceof Error && e.message.includes("no_energy") ? gameError(e) : shopErrorMessage(e)); haptic("error"); }
    finally { setSpinning(false); }
  }

  async function confirm(id: string) {
    const r = await checkFn({ data: { initData, id } });
    if (r.paid) { toast.success("اتضافت اللفات!"); haptic("success"); await q.refetch(); }
  }
  async function buy(pack: string) {
    if (!initData) { toast("افتح اللعبة من تيليجرام عشان تشتري"); return; }
    setBusy(true);
    try {
      const ui = await getTonConnect();
      if (!ui.connected) { await ui.openModal(); toast("اربط محفظتك وبعدين اشتري"); return; }
      const pay = await createFn({ data: { initData, pack } });
      await ui.sendTransaction({ validUntil: Math.floor(Date.now() / 1000) + 600, messages: [{ address: pay.address, amount: pay.amount, payload: pay.payload }] });
      toast("تم إرسال الدفعة، جارٍ تأكيدها…");
      for (let i = 0; i < 12; i++) {
        await new Promise((res) => setTimeout(res, 5000));
        try { await confirm(pay.id); return; }
        catch (e) { if (!(e instanceof Error && e.message.includes("not_found_yet"))) throw e; }
      }
      toast("التأكيد لسه موصلش؛ تقدر تتحقق تاني من غير ما تدفع");
    } catch (e) { toast.error(shopErrorMessage(e)); }
    finally { setBusy(false); }
  }

  const spins = s?.spins ?? 0;
  const revengeable = (s?.attacks ?? []).filter((a) => !a.blocked && !a.avenged);

  const tabs = [{ id: "novel", label: "الحكاية" }, { id: "riddle", label: "اللغز" }, { id: "raid", label: "الغارات" }] as const;

  return <main className={cn("nft-night relative mx-auto max-w-md overflow-hidden", tab === "novel" ? "h-dvh" : "min-h-dvh pb-28")}>
    <StarField />
    {tab === "novel" && <AnimeNovel initData={initData} />}
    <header className="relative z-20 flex items-center justify-between gap-2 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <h1 className="font-display text-xl font-extrabold">حكايات السور</h1>
      <nav className="glass relative flex rounded-full p-1" aria-label="أقسام اللعبة">
        <span className="absolute inset-y-1 rounded-full bg-primary transition-all duration-300" style={{ width: "calc((100% - 0.5rem) / 3)", insetInlineStart: `calc(0.25rem + ${tabs.findIndex((t) => t.id === tab)} * (100% - 0.5rem) / 3)` }} />
        {tabs.map((t) => <button key={t.id} type="button" onClick={() => setTab(t.id)} className={cn("relative z-10 w-16 rounded-full py-1.5 text-xs font-extrabold transition-colors", tab === t.id ? "text-primary-foreground" : "text-foreground/70")}>{t.label}</button>)}
      </nav>
    </header>

    {tab === "riddle" && <div className="vn-tab-in"><StoryGame initData={initData} /></div>}

    {tab === "raid" && <div className="vn-tab-in">
    {/* Vault jackpot */}
    <section className="glass raid-vault-glow relative z-10 mx-4 mt-4 rounded-3xl p-4 text-center">
      <p className="text-xs text-foreground/70">الخزينة الكبرى</p>
      <p dir="ltr" className="pass-number font-display text-4xl font-extrabold">{s ? formatAmount(s.pot) : "—"} <span className="text-lg">{COIN.symbol}</span></p>
      <div className="mt-2 flex items-center justify-center gap-2">
        {Array.from({ length: VAULT_KEYS }, (_, i) => <KeyRound key={i} className={cn("size-6", i < (s?.keys ?? 0) ? "text-accent" : "text-foreground/25")} />)}
      </div>
      <p className="mt-1 text-[0.7rem] text-foreground/60">جمّع {VAULT_KEYS} مفاتيح من العجلة وافتح الخزينة، وتكسب 10% منها</p>
    </section>

    {/* Wheel */}
    <section className="relative z-10 mx-auto mt-6 w-64">
      <div className="absolute -top-3 left-1/2 z-10 h-0 w-0 -translate-x-1/2 border-x-[12px] border-t-[20px] border-x-transparent border-t-accent" />
      <div className="raid-wheel relative aspect-square rounded-full" style={{ transform: `rotate(${angle}deg)` }}>
        {WHEEL.map((w, i) => <span key={i} className="absolute left-1/2 top-1/2 origin-center font-display text-sm font-extrabold text-foreground"
          style={{ transform: `translate(-50%,-50%) rotate(${i * 45}deg) translateY(-5.8rem)` }}>{w.label}</span>)}
        <div className="glass absolute inset-[38%] flex items-center justify-center rounded-full">
          <AnimatedEmoji name="spark" className="size-10 text-accent" />
        </div>
      </div>
    </section>

    <section className="relative z-10 mt-5 space-y-2 px-5">
      {result && <p key={angle} className="raid-pop glass rounded-2xl p-3 text-center font-display font-extrabold">{resultText(result)}</p>}
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1 text-foreground/80"><Shield className="size-4 text-accent" /> دروع: {s?.shields ?? 0}/3</span>
        <span className="text-foreground/80">لفات: <b className="text-accent">{spins}</b>{spins < MAX_FREE_SPINS && <span className="text-xs"> (+1 كل ساعة)</span>}</span>
      </div>
      <Button className="btn-cta h-14 w-full rounded-2xl text-xl font-extrabold" disabled={spinning || (!!initData && (q.isPending || spins <= 0))} onClick={() => spin()}>
        {spinning ? "بتلف…" : spins <= 0 && s ? "خلصت اللفات" : "لُف"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">لفة إضافية بإعلان · بلا حد</p>
      <GameAdButtons initData={initData} benefit="spin" disabled={spinning || busy} />
      <div className="pt-3"><EnergyBar initData={initData} disabled={spinning || busy} /></div>
      <Link to="/squads" className="flex items-center justify-center gap-2 py-3 font-bold text-accent"><Swords className="size-4" /> دوري التحالفات</Link>
    </section>

    {/* Revenge */}
    {revengeable.length > 0 && <section className="relative z-10 mt-6 px-4">
      <h2 className="mb-2 font-display text-lg font-extrabold">هجموا عليك!</h2>
      <div className="space-y-2">
        {revengeable.slice(0, 5).map((a) => <div key={a.id} className="glass flex items-center gap-3 rounded-2xl p-3">
          <Swords className="size-6 shrink-0 text-destructive" />
          <span className="min-w-0 flex-1 text-sm"><b>{a.attacker}</b> سرق منك {formatAmount(a.amount)}</span>
          <Button size="sm" variant="destructive" disabled={spinning || spins <= 0} onClick={() => spin(a.id)}>انتقم</Button>
        </div>)}
      </div>
    </section>}

    {/* Buy spins */}
    <section className="relative z-10 mt-6 px-4">
      <h2 className="mb-2 font-display text-lg font-extrabold">لفات إضافية</h2>
      <div className="grid grid-cols-3 gap-2">
        {SPIN_PACKS.map((p) => <button key={p.id} disabled={busy} onClick={() => buy(p.id)} className="glass relative flex flex-col items-center gap-1 rounded-2xl p-3 disabled:opacity-60">
          {p.tag && <span className="absolute -top-2 rounded-full bg-accent px-2 text-[0.6rem] font-bold text-accent-foreground">{p.tag}</span>}
          <span className="font-display text-2xl font-extrabold">{p.spins}</span>
          <span className="text-[0.7rem] text-foreground/70">لفة</span>
          <span dir="ltr" className="text-sm font-extrabold text-accent">{p.ton} TON</span>
        </button>)}
      </div>
      {s?.pendingId && <Button variant="outline" className="mt-2 w-full" disabled={busy} onClick={() => { setBusy(true); confirm(s.pendingId!).catch((e) => toast.error(shopErrorMessage(e))).finally(() => setBusy(false)); }}>تحقق من دفعة سابقة</Button>}
    </section>
    </div>}
    <BottomNav />
  </main>;
}
