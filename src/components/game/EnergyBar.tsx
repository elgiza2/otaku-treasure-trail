import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Zap } from "lucide-react";
import { getEnergy } from "@/lib/game.functions";
import { energyNow, ENERGY_MAX } from "@/lib/game-model";
import { useNow } from "@/components/tasks/use-now";
import { GameAdButtons } from "./GameAdButtons";

export function useEnergy(initData: string) {
  const load = useServerFn(getEnergy);
  const now = useNow(1000);
  const q = useQuery({ queryKey: ["wall-energy", initData], queryFn: () => load({ data: { initData } }), enabled: !!initData });
  return { ...q, value: q.data ? energyNow(q.data, now) : null };
}
export function EnergyBar({ initData, disabled = false }: { initData: string; disabled?: boolean }) {
  const energy = useEnergy(initData);
  return <div className="space-y-2">
    <div className="flex items-center justify-between text-xs"><span className="flex items-center gap-1"><Zap className="size-4 text-accent" /> الطاقة</span><span dir="ltr" className="tabular-nums">{energy.value ?? "—"}/{ENERGY_MAX}</span></div>
    <progress className="h-1.5 w-full accent-primary" max={ENERGY_MAX} value={energy.value ?? 0} aria-label="الطاقة" />
    {energy.isError && <p role="alert" className="text-xs text-destructive">تعذّر تحميل الطاقة</p>}
    {energy.value !== null && energy.value < ENERGY_MAX && <><p className="text-xs text-muted-foreground">شحن كامل بإعلان</p><GameAdButtons initData={initData} benefit="energy" disabled={disabled} /></>}
  </div>;
}