import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { showAdsgramAd } from "@/lib/adsgram";
import { showRewardedAd } from "@/lib/monetag";
import { claimGameAd } from "@/lib/game.functions";
import { gameError, type AdBenefit } from "@/lib/game-model";
import type { AdProvider } from "@/lib/tournament-model";

export function GameAdButtons({ initData, benefit, disabled = false, onReward, onBusyChange }: {
  initData: string; benefit: AdBenefit; disabled?: boolean; onReward?: (amount: number) => void; onBusyChange?: (busy: boolean) => void;
}) {
  const qc = useQueryClient();
  const claim = useServerFn(claimGameAd);
  const [busy, setBusy] = useState<AdProvider | null>(null);
  const [retry, setRetry] = useState<{ provider: AdProvider; id: string } | null>(null);
  const lock = useRef(false);
  async function watch(provider: AdProvider) {
    if (!initData) { toast("افتح اللعبة من تيليجرام عشان تستلم المكافآت"); return; }
    if (lock.current) return;
    lock.current = true; setBusy(provider); onBusyChange?.(true);
    let completed = false;
    const id = retry?.id ?? crypto.randomUUID();
    try {
      if (!retry) { await (provider === "adsgram" ? showAdsgramAd() : showRewardedAd()); }
      completed = true;
      const r = await claim({ data: { initData, provider: retry?.provider ?? provider, benefit, requestId: id } });
      setRetry(null);
      await qc.invalidateQueries();
      toast.success(benefit === "spin" ? "اتضافت لفة +15 ANIME +10 نقاط" : benefit === "energy" ? "الطاقة اتشحنت +15 ANIME +10 نقاط" : "اتضاعفت الغنيمة +15 ANIME +10 نقاط");
      onReward?.(r.amount);
    } catch (e) { if (completed) setRetry({ provider, id }); toast.error(gameError(e)); }
    finally { lock.current = false; setBusy(null); onBusyChange?.(false); }
  }
  if (retry) return <Button className="w-full" disabled={busy !== null} onClick={() => watch(retry.provider)}><RefreshCw className="size-4" /> إعادة استلام المكافأة</Button>;
  return <div className="grid grid-cols-2 gap-2">
    {(["adsgram", "monetag"] as const).map((provider) => <Button key={provider} variant={provider === "adsgram" ? "default" : "outline"} disabled={disabled || busy !== null} onClick={() => watch(provider)}>
      {busy === provider ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}{provider === "adsgram" ? "Adsgram" : "Monetag"}
    </Button>)}
  </div>;
}