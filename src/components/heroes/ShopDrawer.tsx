import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { AnimatedEmoji } from "@/components/emoji/AnimatedEmoji";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { COIN, formatAmount } from "@/lib/coin";
import { PACKS, shopErrorMessage, type PackId } from "@/lib/shop-model";
import { checkTonPayment, createTonPayment } from "@/lib/shop.functions";
import { haptic } from "@/lib/telegram";
import { getTonConnect } from "@/lib/ton-connect";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function ShopDrawer({ open, onOpenChange, initData, onPaid }: {
  open: boolean; onOpenChange: (o: boolean) => void; initData: string; onPaid: () => void;
}) {
  const [busy, setBusy] = useState<PackId | null>(null);
  const createFn = useServerFn(createTonPayment);
  const checkFn = useServerFn(checkTonPayment);

  async function buy(pack: PackId) {
    if (!initData) {
      toast.error("افتح اللعبة من تيليجرام عشان تشتري");
      return;
    }
    setBusy(pack);
    try {
      const ui = await getTonConnect();
      if (!ui.connected) {
        await ui.openModal();
        toast("اربط محفظتك، وبعدها دوس على الباقة تاني");
        return;
      }
      const pay = await createFn({ data: { initData, pack } });
      await ui.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [{ address: pay.address, amount: pay.amount, payload: pay.payload }],
      });
      toast("الدفعة اتبعتت، بنأكدها على الشبكة…");
      for (let i = 0; i < 12; i++) {
        await sleep(5000);
        try {
          const r = await checkFn({ data: { initData, id: pay.id } });
          if (r.paid) {
            haptic("success");
            toast.success(`+${formatAmount(r.coins)} ${COIN.symbol}`, { description: "اتضافت لرصيدك" });
            onPaid();
            onOpenChange(false);
            return;
          }
        } catch (e) {
          if (!(e instanceof Error && e.message.includes("not_found_yet"))) throw e;
        }
      }
      toast("الدفعة لسه بتتأكد — رصيدك هيتحدث أول ما توصل");
    } catch (e) {
      haptic("error");
      toast.error(shopErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="glass mx-auto max-w-md">
        <DrawerHeader className="text-center">
          <DrawerTitle>اشحن عملات</DrawerTitle>
          <DrawerDescription>الدفع بـ TON من محفظتك</DrawerDescription>
        </DrawerHeader>
        <div className="grid grid-cols-2 gap-3 px-4 pb-8">
          {PACKS.map((p, i) => (
            <button key={p.id} type="button" disabled={busy !== null} onClick={() => buy(p.id)}
              className="glass-card flex flex-col items-center gap-1 rounded-3xl p-4 disabled:opacity-50">
              <AnimatedEmoji name={i >= 2 ? "gem" : "crystal"} className="size-10 text-accent" />
              <span className="text-xs text-muted-foreground">{p.label}</span>
              <span className="text-gold text-lg font-extrabold">{formatAmount(p.coins)}</span>
              <span className="btn-cta mt-1 w-full rounded-full py-1.5 text-sm font-bold">
                {busy === p.id ? "…" : `${p.ton} TON`}
              </span>
            </button>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
