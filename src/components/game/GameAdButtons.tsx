import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AnimatedEmoji } from "@/components/emoji/AnimatedEmoji";
import { showDualAd } from "@/lib/dual-ad";
import { claimGameAd } from "@/lib/game.functions";
import { gameError, type AdBenefit } from "@/lib/game-model";
import type { AdProvider } from "@/lib/tournament-model";

export function GameAdButtons({ initData, benefit, disabled = false, onReward, onBusyChange }: {
  initData: string; benefit: AdBenefit; disabled?: boolean; onReward?: (amount: number) => void; onBusyChange?: (busy: boolean) => void;
}) {
  const qc = useQueryClient();
  const claim = useServerFn(claimGameAd);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState<{ provider: AdProvider; id: string } | null>(null);
  const lock = useRef(false);
  async function watch() {
    if (!initData) { toast("افتح اللعبة من تيليجرام عشان تستلم المكافآت"); return; }
    if (lock.current) return;
    lock.current = true; setBusy(true); onBusyChange?.(true);
    let completed = false;
    let provider: AdProvider = retry?.provider ?? "adsgram";
    const id = retry?.id ?? crypto.randomUUID();
    try {
      if (!retry) { provider = await showDualAd(); }
      completed = true;
      const r = await claim({ data: { initData, provider: retry?.provider ?? provider, benefit, requestId: id } });
      setRetry(null);
      await qc.invalidateQueries();
      toast.success(benefit === "spin" ? "اتضافت لفة +15 ANIME +10 نقاط" : benefit === "energy" ? "الطاقة اتشحنت +15 ANIME +10 نقاط" : "اتضاعفت الغنيمة +15 ANIME +10 نقاط");
      onReward?.(r.amount);
    } catch (e) { if (completed) setRetry({ provider, id }); toast.error(gameError(e)); }
    finally { lock.current = false; setBusy(false); onBusyChange?.(false); }
  }
  if (retry) return <Button className="glass h-11 w-full rounded-2xl font-bold" variant="outline" disabled={busy} onClick={() => watch()}><RefreshCw className="size-4" /> إعادة استلام المكافأة</Button>;
  return <Button className="btn-cta h-11 w-full rounded-2xl font-display font-extrabold" disabled={disabled || busy} onClick={() => watch()}>
    {busy ? <Loader2 className="size-4 animate-spin" /> : <AnimatedEmoji name="sparkle" className="size-5 text-primary-foreground" />} شاهد إعلان
  </Button>;
}