import { Check, Lock, ShoppingCart, X } from "lucide-react";

import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { COIN, formatAmount } from "@/lib/coin";
import { heroCost, heroRate } from "@/lib/heroes-model";
import { tierName, tierOf } from "./heroes-data";

export type LevelPick = { hero: number; level: number } | null;

export function LevelSheet({ pick, onClose, levels, unlocked, balance, busy, onUpgrade, onShop }: {
  pick: LevelPick; onClose: () => void; levels: number[]; unlocked: boolean; balance: number; busy: boolean;
  onUpgrade: (hero: number) => void; onShop: () => void;
}) {
  const hero = pick?.hero ?? 0;
  const n = pick?.level ?? 1;
  const owned = levels[hero] ?? 0;
  const cost = heroCost(hero, n - 1);
  const isNext = unlocked && n === owned + 1;
  const missing = Math.max(0, cost - balance);

  return (
    <Drawer open={pick !== null} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="glass mx-auto max-w-md px-5 pb-8">
        <div className="flex items-start justify-between pt-3">
          <div>
            <DrawerTitle className="text-3xl font-extrabold">المستوى {n}</DrawerTitle>
            <p className="text-gold mt-1 text-2xl font-extrabold">{tierName(hero, tierOf(n))}</p>
            <DrawerDescription>الرتبة {tierOf(n) + 1} من 20</DrawerDescription>
          </div>
          <DrawerClose aria-label="إغلاق" className="glass rounded-full p-2"><X className="size-4" /></DrawerClose>
        </div>

        <div className="mt-5 grid grid-cols-3 text-center">
          <div><p className="text-xs text-muted-foreground">السرعة</p><p className="text-xl font-extrabold">{formatAmount(heroRate(hero, n))}<span className="text-xs">/س</span></p></div>
          <div><p className="text-xs text-muted-foreground">يوميًا</p><p className="text-xl font-extrabold">{formatAmount(heroRate(hero, n) * 24)}</p></div>
          <div><p className="text-xs text-muted-foreground">السعر</p><p className="text-xl font-extrabold">{formatAmount(cost)}</p></div>
        </div>

        <div className="glass-card mt-5 rounded-3xl p-4">
          <div className="flex justify-between text-sm">
            <span>رصيدك</span>
            <span className="text-gold font-bold">{formatAmount(balance)} / {formatAmount(cost)}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div className="bg-gold-bar h-full rounded-full" style={{ width: `${Math.min(100, (balance / cost) * 100)}%` }} />
          </div>
        </div>

        {n <= owned ? (
          <div className="glass-card mt-5 flex items-center justify-center gap-2 rounded-2xl py-3.5 font-semibold"><Check className="size-5 text-success" /> مفتوح</div>
        ) : !isNext ? (
          <div className="glass-card mt-5 flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm text-muted-foreground">
            <Lock className="size-4" /> {unlocked ? `افتح مستوى ${owned + 1} الأول` : "البطل ده لسه مقفول"}
          </div>
        ) : missing > 0 ? (
          <>
            <p className="text-gold mt-5 text-center text-sm font-semibold">ناقصك {formatAmount(missing)} {COIN.symbol} عشان توصل هنا</p>
            <button type="button" onClick={onShop} className="btn-cta mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 font-extrabold">
              <ShoppingCart className="size-5" /> اشحن {COIN.symbol}
            </button>
          </>
        ) : (
          <button type="button" disabled={busy} onClick={() => onUpgrade(hero)} className="btn-cta mt-5 w-full rounded-2xl py-3.5 font-extrabold disabled:opacity-50">
            رقّي بـ {formatAmount(cost)} {COIN.symbol}
          </button>
        )}
      </DrawerContent>
    </Drawer>
  );
}
