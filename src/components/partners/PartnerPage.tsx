import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Radio, Wallet } from "lucide-react";
import { toast } from "sonner";
import terrace from "@/assets/profile/garrison-terrace.jpg";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { getMyChannels, requestPartnerWithdrawal } from "@/lib/partner.functions";
import { partnerLink, PARTNER_REWARD_GRAM } from "@/lib/partner-model";
import { useTelegramInitData } from "@/lib/telegram";
import { formatAmount } from "@/lib/coin";
import { useNow } from "@/components/tasks/use-now";

export function PartnerPage() {
  const initData = useTelegramInitData();
  const now = useNow(1000);
  const load = useServerFn(getMyChannels);
  const withdraw = useServerFn(requestPartnerWithdrawal);
  const q = useQuery({ queryKey: ["wall-partner-channels", initData], queryFn: () => load({ data: { initData } }), enabled: !!initData });
  const [selected, setSelected] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const channels = q.data?.channels ?? [];
  const firstStart = channels.reduce((earliest, c) => Math.min(earliest, Date.parse(c.started_at)), Infinity);
  const lastWithdrawal = channels.reduce((latest, c) => Math.max(latest, c.last_withdrawal_at ? Date.parse(c.last_withdrawal_at) : 0), 0);
  const opensAt = (lastWithdrawal || firstStart) + 30 * 86_400_000;
  async function submit() {
    if (!selected) return;
    setBusy(true);
    try { await withdraw({ data: { initData, channel: selected, address } }); await q.refetch(); setSelected(null); toast.success("طلب السحب اتسجل للمراجعة"); }
    catch { toast.error("تعذّر طلب السحب، راجع الموعد وعنوان المحفظة"); } finally { setBusy(false); }
  }
  return <main className="relative mx-auto min-h-dvh max-w-md overflow-x-hidden pb-28">
    <div className="pointer-events-none absolute inset-x-0 top-0 h-80 overflow-hidden"><img src={terrace} alt="" className="size-full object-cover" /><div className="profile-shade absolute inset-0" /></div>
    <div className="relative px-4 pt-10"><Radio className="mx-auto size-8 text-accent" /><h1 className="mt-3 text-center font-display text-3xl font-extrabold">قنوات الشركاء</h1><p className="mt-2 text-center text-sm text-gold">{PARTNER_REWARD_GRAM} GRAM لكل مستخدم جديد</p><p className="mt-1 text-center text-xs text-muted-foreground">السحب كل 30 يوم · منشوران يومياً</p>
      <div className="mt-6 grid grid-cols-2 border-y border-border py-4 text-center"><div><p className="text-xs text-muted-foreground">رصيد الأرباح</p><p className="text-xl font-bold text-gold" dir="ltr">{formatAmount(channels.reduce((sum, c) => sum + Number(c.balance_gram), 0))} GRAM</p></div><div><p className="text-xs text-muted-foreground">المستخدمون المنضمون</p><p className="text-xl font-bold">{formatAmount(channels.reduce((sum, c) => sum + c.joined_users, 0))}</p></div></div>
      <p className="mt-5 text-center text-sm text-muted-foreground">تسجيل القنوات والنشر ينتظران تفعيل البوت</p>
      {!initData && <p className="mt-3 text-center text-xs text-muted-foreground">افتح اللعبة من تيليجرام لعرض بياناتك</p>}
      {q.isError && <p role="alert" className="mt-3 text-sm text-destructive">تعذّر تحميل القنوات</p>}
      <div className="mt-5 space-y-3">{channels.map((c) => <article key={c.id} className="glass-card rounded-lg p-4"><div className="flex justify-between gap-2"><h2 className="min-w-0 break-words font-bold">{c.title}</h2><span className="text-xs text-muted-foreground">{c.status}</span></div><p className="mt-1 text-xs text-muted-foreground">{c.joined_users} منضم</p><p className="mt-2 font-bold text-gold" dir="ltr">{formatAmount(Number(c.balance_gram))} GRAM</p><p className="mt-1 text-xs text-muted-foreground">موعد السحب: {new Date(opensAt).toLocaleDateString("ar-EG")}</p><div className="mt-3 flex gap-2"><Button variant="outline" className="flex-1" disabled={Number(c.balance_gram) <= 0 || now < opensAt} onClick={() => setSelected(c.id)}><Wallet /> طلب سحب</Button><Button variant="outline" size="icon" aria-label="نسخ رابط الدعوة" onClick={() => { void navigator.clipboard.writeText(partnerLink(c.id)).then(() => toast.success("تم نسخ رابط الدعوة")).catch(() => toast.error("تعذّر نسخ الرابط")); }}><Copy /></Button></div></article>)}</div>
      <section className="mt-6"><h2 className="font-bold">طلبات السحب</h2>{q.data?.withdrawals.map((w) => <div key={w.id} className="mt-2 flex justify-between border-b border-border py-3 text-sm"><span dir="ltr">{w.amount_gram} GRAM</span><span>{w.status}</span></div>)}</section>
    </div>
    <Dialog open={selected !== null} onOpenChange={(open) => { if (!busy && !open) setSelected(null); }}><DialogContent className="max-w-sm"><DialogTitle>طلب سحب أرباح القنوات</DialogTitle><DialogDescription>عنوان محفظة TON لاستلام GRAM بعد مراجعة الطلب</DialogDescription><Input dir="ltr" aria-label="عنوان المحفظة" value={address} onChange={(e) => setAddress(e.target.value)} /><Button disabled={busy || !/^(EQ|UQ)[A-Za-z0-9_-]{46}$/.test(address)} onClick={submit}>طلب سحب</Button></DialogContent></Dialog>
    <BottomNav />
  </main>;
}