import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { getPartnerAdmin, reviewPartnerWithdrawal, saveDailyRevenue } from "@/lib/partner.functions";
import { netRevenue, type DailyReport } from "@/lib/partner-model";
import { useTelegramInitData } from "@/lib/telegram";

export function PartnerAdminPanel() {
  const initData = useTelegramInitData();
  const fetchData = useServerFn(getPartnerAdmin);
  const saveRevenue = useServerFn(saveDailyRevenue);
  const review = useServerFn(reviewPartnerWithdrawal);
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<DailyReport | null>(null);
  const [amounts, setAmounts] = useState({ adsgram: "", monetag: "", costs: "" });
  const [payment, setPayment] = useState<string | null>(null);
  const [tx, setTx] = useState("");
  const [busy, setBusy] = useState(false);
  const q = useQuery({ queryKey: ["wall-partner-admin", initData, page], queryFn: () => fetchData({ data: { initData, page } }), enabled: !!initData });
  const data = q.data;
  if (!data) return <p role={q.isError ? "alert" : "status"} className="text-sm text-muted-foreground">{q.isError ? "تعذّر تحميل تقرير القنوات" : "جارٍ تحميل تقرير القنوات…"}</p>;
  async function save() {
    if (!editing) return;
    setBusy(true);
    try { await saveRevenue({ data: { initData, day: editing.day, adsgram: Number(amounts.adsgram), monetag: Number(amounts.monetag), costs: Number(amounts.costs) } }); await q.refetch(); setEditing(null); toast.success("التقرير اتحفظ"); }
    catch { toast.error("تعذّر حفظ التقرير"); } finally { setBusy(false); }
  }
  async function process(id: string, paid: boolean) {
    setBusy(true);
    try { await review({ data: { initData, id, paid, ...(paid ? { tx } : {}) } }); await q.refetch(); setPayment(null); setTx(""); toast.success("تم تحديث طلب السحب"); }
    catch { toast.error("تعذّر تحديث طلب السحب"); } finally { setBusy(false); }
  }
  function exportCsv() {
    const header = ["day", "adsgram_views", "monetag_views", "new_channels", "new_users", "partner_users", "partner_earned_gram", "paid_ton", "adsgram_revenue_usd", "monetag_revenue_usd", "costs_usd"] as const;
    const csv = [header.join(","), ...(data?.reports ?? []).map((r) => header.map((key) => r[key] ?? "").join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "channel-daily-reports.csv"; a.click(); URL.revokeObjectURL(url);
  }
  return <section className="space-y-4 border-t border-border pt-5">
    <div className="flex items-center justify-between"><h2 className="text-xl font-bold">القنوات والتقارير اليومية</h2><div className="flex gap-1"><Button size="icon" variant="ghost" aria-label="تحديث التقرير" onClick={() => q.refetch()}><RefreshCw /></Button><Button size="icon" variant="outline" aria-label="تنزيل التقارير" onClick={exportCsv}><Download /></Button></div></div>
    <h3 className="text-sm font-semibold">آخر 24 ساعة</h3><dl className="grid grid-cols-2 gap-3">{([
      ["إعلانات Adsgram", data.overview.adsgramViews], ["إعلانات Monetag", data.overview.monetagViews], ["قنوات جديدة", data.overview.newChannels], ["مستخدمون جدد", data.overview.newUsers], ["أرباح الشركاء GRAM", data.overview.partnerEarnedGram], ["إجمالي القنوات", data.count],
    ] as const).map(([label, value]) => <div key={label} className="border-b border-border py-2"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="text-xl font-bold tabular-nums">{value}</dd></div>)}</dl>
    <div className="space-y-3"><h3 className="font-bold">القنوات المسجلة</h3>{data.channels.length === 0 && <p className="text-sm text-muted-foreground">مفيش قنوات مسجلة لسه</p>}{data.channels.map((c) => <article key={c.id} className="glass-card space-y-1 rounded-lg p-3"><p className="break-words font-bold">{c.title}</p><p className="text-xs text-muted-foreground" dir="ltr">{c.username ? `@${c.username}` : c.chat_id} · Owner {c.owner_tg}</p><p className="text-xs">{c.status} · {c.joined_users} منضم</p><p className="text-sm text-gold" dir="ltr">{c.earned_gram} GRAM · Balance {c.balance_gram}</p><p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString("ar-EG")}</p></article>)}<div className="flex justify-between"><Button variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>السابق</Button><Button variant="outline" disabled={(page + 1) * 50 >= data.count} onClick={() => setPage(page + 1)}>التالي</Button></div></div>
    <div className="space-y-3"><h3 className="font-bold">طلبات السحب المعلقة</h3>{data.withdrawals.map((w) => <article key={w.id} className="glass-card rounded-lg p-3"><p className="font-bold" dir="ltr">{w.amount_gram} GRAM</p><p className="mt-1 break-all text-xs text-muted-foreground" dir="ltr">{w.address}</p><p className="text-xs" dir="ltr">Owner {w.owner_tg}</p><div className="mt-2 flex gap-2"><Button size="sm" disabled={busy} onClick={() => setPayment(w.id)}>تأكيد الدفع</Button><Button size="sm" variant="destructive" disabled={busy} onClick={() => { if (confirm("رفض الطلب وإرجاع الرصيد؟")) void process(w.id, false); }}>رفض الطلب</Button></div></article>)}</div>
    <div className="space-y-3"><h3 className="font-bold">التقارير اليومية</h3><p className="text-xs text-muted-foreground">دخل الإعلانات والتكاليف بالدولار من سجلات الشبكات؛ الأرباح غير المتاحة تظهر بشرطة</p>{data.reports.map((r) => <article key={r.day} className="glass-card rounded-lg p-3"><div className="flex items-center justify-between"><h4 className="font-bold" dir="ltr">{r.day}</h4><Button size="sm" variant="outline" onClick={() => { setEditing(r); setAmounts({ adsgram: r.adsgram_revenue_usd?.toString() ?? "", monetag: r.monetag_revenue_usd?.toString() ?? "", costs: r.costs_usd?.toString() ?? "" }); }}>تسجيل الدخل</Button></div><dl className="mt-3 grid grid-cols-2 gap-2 text-xs">{([
      ["إعلانات Adsgram", r.adsgram_views], ["إعلانات Monetag", r.monetag_views], ["قنوات جديدة", r.new_channels], ["مستخدمون جدد", r.new_users], ["منضمون من القنوات", r.partner_users], ["أرباح الشركاء GRAM", r.partner_earned_gram], ["مدفوعات TON", r.paid_ton], ["صافي دخل الإعلانات USD", netRevenue(r)?.toFixed(2) ?? "—"],
    ] as const).map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="font-bold">{value}</dd></div>)}</dl></article>)}</div>
    <Dialog open={editing !== null} onOpenChange={(v) => { if (!busy && !v) setEditing(null); }}><DialogContent className="max-w-sm"><DialogTitle>تسجيل دخل الإعلانات</DialogTitle><DialogDescription>{editing?.day} · USD</DialogDescription>{(["adsgram", "monetag", "costs"] as const).map((key) => <label key={key} className="text-sm">{key === "costs" ? "التكاليف بالدولار" : key === "adsgram" ? "Adsgram USD" : "Monetag USD"}<Input type="number" min="0" step="0.01" value={amounts[key]} onChange={(e) => setAmounts({ ...amounts, [key]: e.target.value })} /></label>)}<Button disabled={busy || Object.values(amounts).some((v) => v === "" || !Number.isFinite(Number(v)) || Number(v) < 0)} onClick={save}><Save /> حفظ التقرير</Button></DialogContent></Dialog>
    <Dialog open={payment !== null} onOpenChange={(v) => { if (!busy && !v) setPayment(null); }}><DialogContent className="max-w-sm"><DialogTitle>تأكيد دفع GRAM</DialogTitle><DialogDescription>سجل رقم المعاملة بعد إرسال GRAM للمحفظة</DialogDescription><Input dir="ltr" aria-label="رقم المعاملة" value={tx} onChange={(e) => setTx(e.target.value)} /><Button disabled={busy || tx.trim().length < 8} onClick={() => { if (payment) void process(payment, true); }}>تأكيد الدفع</Button></DialogContent></Dialog>
  </section>;
}