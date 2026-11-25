import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AnimatedEmoji } from "@/components/emoji/AnimatedEmoji";
import { getMinePass } from "@/lib/mine-pass.functions";
import { formatPassNumber, MINE_PASS_TON } from "@/lib/mine-pass-model";
import { telegramDisplayName } from "@/lib/telegram";
import passArt from "@/assets/mine-pass/mine-pass-art.jpg";
import { createTonPayment, checkTonPayment } from "@/lib/shop.functions";
import { shopErrorMessage } from "@/lib/shop-model";
import { getTonConnect } from "@/lib/ton-connect";
export function VerifiedBadge() {
  return <span aria-label="حساب موثق" title="حساب موثق بتصريح التعدين" className="inline-flex align-middle"><AnimatedEmoji name="verified" keepColors className="size-5" /></span>;
}

export function MinePassCard({ initData, variant = "row" }: { initData: string; variant?: "row" | "stacked" }) {
  const qc = useQueryClient();
  const fetchFn = useServerFn(getMinePass);
  const createFn = useServerFn(createTonPayment);
  const checkFn = useServerFn(checkTonPayment);
  const [busy, setBusy] = useState(false);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const status = useQuery({ queryKey: ["wall-mine-pass", initData], queryFn: () => fetchFn({ data: { initData } }), enabled: !!initData });
  const pass = status.data?.pass;
  const pendingId = paymentId ?? status.data?.pendingId;
  async function confirm(id: string) {
    const result = await checkFn({ data: { initData, id } });
    if (result.paid) {
      await Promise.all(["wall-mine-pass", "wall-heroes", "wall-profile", "wall-board"].map((key) => qc.invalidateQueries({ queryKey: [key] })));
      setPaymentId(null);
      toast.success("تم توثيق حسابك وتفعيل التعدين");
    }
  }
  async function check() {
    if (!pendingId) return;
    setBusy(true);
    try { await confirm(pendingId); } catch (e) { toast.error(shopErrorMessage(e)); } finally { setBusy(false); }
  }
  async function buy() {
    if (!initData) { toast("افتح اللعبة من تيليجرام لتفعيل التصريح"); return; }
    setBusy(true);
    try {
      const ui = await getTonConnect();
      if (!ui.connected) { await ui.openModal(); toast("اربط محفظتك ثم فعّل التصريح"); return; }
      const pay = await createFn({ data: { initData, pack: "mine_pass" } });
      setPaymentId(pay.id);
      await ui.sendTransaction({ validUntil: Math.floor(Date.now() / 1000) + 600, messages: [{ address: pay.address, amount: pay.amount, payload: pay.payload }] });
      toast("تم إرسال الدفعة، جارٍ تأكيدها…");
      for (let attempt = 0; attempt < 12; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        try { await confirm(pay.id); return; }
        catch (e) { if (!(e instanceof Error && e.message.includes("not_found_yet"))) throw e; }
      }
      toast("التأكيد لم يصل بعد؛ يمكنك التحقق من الدفع بدون دفع مرة أخرى");
    } catch (e) { toast.error(shopErrorMessage(e)); }
    finally { setBusy(false); void status.refetch(); }
  }
  if (pass) {
    return <section aria-label="تصريح التعدين" className="mx-auto w-full max-w-[18rem]">
      <PassArt number={pass.number} activatedAt={pass.activatedAt} />
      <p className="mt-3 flex items-center justify-center gap-2 text-xs text-foreground/80"><VerifiedBadge />حساب موثق · التعدين مفعّل</p>
    </section>;
  }
  const actions = <div className="mt-4 space-y-2">
    <Button className="btn-cta h-11 w-full rounded-xl" disabled={busy || (!!initData && status.isPending) || status.isError} onClick={buy}>{busy ? "جارٍ التحقق…" : "احصل على بطاقتك"}</Button>
    {pendingId && <Button variant="outline" className="w-full" disabled={busy} onClick={check}>تحقق من دفعة سابقة</Button>}
    {status.isError && <Button variant="outline" className="w-full" onClick={() => void status.refetch()}>إعادة تحميل التصريح</Button>}
  </div>;
  if (variant === "stacked") {
    return <section className="glass rounded-2xl p-4" aria-label="تصريح التعدين">
      <div className="flex items-center gap-3">
        <div className="w-16 shrink-0"><PassArt compact /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-base font-extrabold" dir="ltr">Mine Pass</h2>
            <span dir="ltr" className="shrink-0 text-sm font-bold text-accent">{MINE_PASS_TON} TON</span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-foreground/75">فعّل بطاقتك عشان أبطالك يبدأوا التعدين.</p>
        </div>
      </div>
      {actions}
    </section>;
  }
  return <section className="wallet-surface rounded-2xl p-4" aria-label="تصريح التعدين">
    <div className="flex items-center gap-4">
      <div className="w-24 shrink-0"><PassArt compact /></div>
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-extrabold" dir="ltr">Mine Pass</h2>
        <p className="mt-1 text-xs leading-relaxed text-foreground/80">بطاقة خاصة بيك برقم مميز محدش غيرك هياخده. التعدين متوقف لحد ما تفعّلها.</p>
        <p dir="ltr" className="mt-2 text-end text-sm font-bold text-accent">{MINE_PASS_TON} TON</p>
      </div>
    </div>
    {actions}
  </section>;
}

/** Collectible pass artwork: same art for everyone, the serial number makes each card unique. */
export function PassArt({ number, activatedAt, compact }: { number?: number; activatedAt?: string; compact?: boolean }) {
  const locked = number === undefined;
  const [holder, setHolder] = useState("");
  useEffect(() => { setHolder(telegramDisplayName()); }, []);
  const date = activatedAt ? new Date(activatedAt).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" }) : "";
  return <div className={`pass-frame ${compact ? "rounded-xl p-px" : "rounded-[1.4rem] p-[2px]"}`}>
    <div className={`relative aspect-[3/4] overflow-hidden bg-background ${compact ? "rounded-[0.7rem]" : "rounded-[1.3rem]"}`}>
      <img src={passArt} alt={locked ? "بطاقة تصريح التعدين" : `بطاقة تصريح التعدين رقم ${formatPassNumber(number)}`} width={768} height={1024} loading="lazy" className={`absolute inset-0 size-full object-cover ${locked ? "pass-locked" : ""}`} />
      <div className="pass-shade absolute inset-0" />
      {!locked && <div className="pass-shine pointer-events-none absolute inset-0" />}
      {compact ? <span dir="ltr" className="absolute inset-x-0 bottom-1.5 text-center font-display text-sm font-extrabold text-foreground/70">{locked ? "#????" : formatPassNumber(number)}</span> : <>
        <div dir="ltr" className="absolute inset-x-4 top-3 flex items-center justify-between text-[0.65rem] font-bold uppercase tracking-[0.2em] text-foreground/85">
          <span>Mine Pass</span><span className="rounded-full border border-accent/50 bg-background/40 px-2 py-0.5 text-accent">Wall</span>
        </div>
        <div className="absolute inset-x-4 bottom-4">
          <p className="text-[0.7rem] text-foreground/70">رقم البطاقة</p>
          <p dir="ltr" className="pass-number text-end font-display text-5xl font-extrabold leading-tight">{locked ? "#????" : formatPassNumber(number)}</p>
          <div className="mt-2 flex items-end justify-between gap-2 border-t border-foreground/15 pt-2 text-[0.7rem]">
            <span className="min-w-0 truncate"><span className="block text-foreground/60">المالك</span><span className="font-bold">{holder || "جندي الحامية"}</span></span>
            {date && <span className="shrink-0 text-end"><span className="block text-foreground/60">تاريخ الإصدار</span><span className="font-bold">{date}</span></span>}
          </div>
        </div>
      </>}
    </div>
  </div>;
}
