import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { checkTonPayment, createTonPayment } from "@/lib/shop.functions";
import { shopErrorMessage } from "@/lib/shop-model";
import { getUserTaskSlot, publishUserTask } from "@/lib/tasks.functions";
import { USER_TASK_MAX_USERS, USER_TASK_PACK, USER_TASK_TON, validateUserTaskInput } from "@/lib/tasks-model";
import { getTonConnect } from "@/lib/ton-connect";

export function AddUserTaskDialog({ initData }: { initData: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [paidId, setPaidId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");

  const slotFn = useServerFn(getUserTaskSlot);
  const createFn = useServerFn(createTonPayment);
  const checkFn = useServerFn(checkTonPayment);
  const publishFn = useServerFn(publishUserTask);

  const slot = useQuery({
    queryKey: ["wall-user-task-slot", initData],
    queryFn: () => slotFn({ data: { initData } }),
    enabled: open && !!initData,
  });

  const activePaidId = paidId ?? slot.data?.paidPaymentId ?? null;
  const activePendingId = pendingId ?? slot.data?.pendingPaymentId ?? null;

  async function confirm(id: string) {
    const res = await checkFn({ data: { initData, id } });
    if (res.paid) {
      setPaidId(id);
      setPendingId(null);
      toast.success("تم تأكيد الدفع! اكتب اسم ورابط مهمتك");
      void slot.refetch();
    }
  }

  async function pay() {
    if (!initData) { toast("افتح اللعبة من تيليجرام عشان تضيف مهمتك"); return; }
    setBusy(true);
    try {
      const ui = await getTonConnect();
      if (!ui.connected) { await ui.openModal(); toast("اربط محفظتك الأول"); return; }
      const tx = await createFn({ data: { initData, pack: USER_TASK_PACK } });
      setPendingId(tx.id);
      await ui.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [{ address: tx.address, amount: tx.amount, payload: tx.payload }],
      });
      toast("تم إرسال الدفعة، جارٍ التأكيد…");
      for (let i = 0; i < 12; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        try { await confirm(tx.id); return; }
        catch (e) { if (!(e instanceof Error && e.message.includes("not_found_yet"))) throw e; }
      }
      toast("التأكيد لم يصل بعد، اضغط تحقق من دفعة سابقة");
    } catch (e) { toast.error(shopErrorMessage(e)); }
    finally { setBusy(false); void slot.refetch(); }
  }

  async function check() {
    if (!activePendingId) return;
    setBusy(true);
    try { await confirm(activePendingId); }
    catch (e) { toast.error(shopErrorMessage(e)); }
    finally { setBusy(false); }
  }

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    if (!activePaidId) return;
    const checked = validateUserTaskInput(title, url);
    if ("error" in checked) { toast.error(checked.error); return; }
    setBusy(true);
    try {
      await publishFn({ data: { initData, paymentId: activePaidId, title: checked.title, url: checked.url } });
      setTitle("");
      setUrl("");
      setPaidId(null);
      setOpen(false);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["wall-tasks"] }),
        qc.invalidateQueries({ queryKey: ["wall-user-task-slot"] }),
      ]);
      toast.success("تم نشر مهمتك لـ 1,000 مستخدم!");
    } catch (err) { toast.error(err instanceof Error ? err.message : "حصلت مشكلة، حاول تاني"); }
    finally { setBusy(false); }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="surface-gold apple-press flex w-full items-center justify-between gap-3 rounded-[1.5rem] px-4 py-3.5 text-start"
      >
        <div className="min-w-0">
          <p className="font-display text-sm font-extrabold text-foreground">أضف مهمتك</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{USER_TASK_TON} TON مقابل {USER_TASK_MAX_USERS.toLocaleString("en-US")} مستخدم</p>
        </div>
        <span className="btn-cta flex h-9 shrink-0 items-center gap-1 rounded-full px-3.5 text-xs font-extrabold" dir="ltr">
          <Plus className="size-4" />{USER_TASK_TON} TON
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogTitle>أضف مهمتك</DialogTitle>
          <DialogDescription>{USER_TASK_TON} TON لـ {USER_TASK_MAX_USERS.toLocaleString("en-US")} مستخدم</DialogDescription>
          {activePaidId ? (
            <form onSubmit={publish} className="space-y-3">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="اسم المهمة" maxLength={80} required />
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="رابط المهمة (https://...)" dir="ltr" required />
              <Button type="submit" disabled={busy} className="btn-cta h-11 w-full rounded-2xl font-extrabold">
                {busy ? "جارٍ النشر…" : "نشر المهمة"}
              </Button>
            </form>
          ) : (
            <div className="space-y-2.5">
              <p className="text-xs leading-relaxed text-muted-foreground">
                ادفع {USER_TASK_TON} TON أولاً، وبعد تأكيد الدفع هتكتب اسم ورابط مهمتك وتتنشر فوراً لـ {USER_TASK_MAX_USERS.toLocaleString("en-US")} مستخدم.
              </p>
              <Button type="button" disabled={busy} onClick={pay} className="btn-cta h-11 w-full rounded-2xl font-extrabold">
                {busy ? "جارٍ التحقق…" : `ادفع ${USER_TASK_TON} TON`}
              </Button>
              {activePendingId ? (
                <Button type="button" variant="outline" disabled={busy} onClick={check} className="w-full rounded-2xl">
                  تحقق من دفعة سابقة
                </Button>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}