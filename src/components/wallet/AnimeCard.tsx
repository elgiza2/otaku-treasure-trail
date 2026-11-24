import { ANIME_EXCHANGES } from "@/lib/anime-exchanges";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDownRight, ArrowUpRight, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNow } from "@/components/tasks/use-now";
import { formatAmount } from "@/lib/coin";
import { claimAnime, getAnime, withdrawAnime } from "@/lib/anime.functions";
import { ANIME_MIN_WITHDRAW, animeErrorMessage, canClaimAnime, canWithdraw, dailyAnime, daysUntilWithdraw } from "@/lib/anime-model";

const BINANCE = "https://www.binance.com/en/trade/ANIME_USDT";

async function fetchPrice() {
  const r = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=ANIMEUSDT");
  if (!r.ok) throw new Error("price");
  const j = await r.json();
  return { price: Number(j.lastPrice), change: Number(j.priceChangePercent) };
}

export function AnimeCard({ initData, address }: { initData: string; address: string | null }) {
  const qc = useQueryClient();
  const now = useNow(30_000);
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const price = useQuery({ queryKey: ["anime-price"], queryFn: fetchPrice, refetchInterval: 60_000 });
  const getFn = useServerFn(getAnime), claimFn = useServerFn(claimAnime), wdFn = useServerFn(withdrawAnime);
  const me = useQuery({ queryKey: ["wall-anime", initData], queryFn: () => getFn({ data: { initData } }), enabled: !!initData });
  const refresh = () => qc.invalidateQueries({ queryKey: ["wall-anime"] });
  const claim = useMutation({ mutationFn: () => claimFn({ data: { initData } }), onSuccess: (r) => { toast.success(`+${r.amount} ANIME`); void refresh(); }, onError: (e) => toast.error(animeErrorMessage(e)) });
  const wd = useMutation({
    mutationFn: async () => {
      let dest = to.trim();
      if (!dest && address) dest = (await import("@tonconnect/ui")).toUserFriendlyAddress(address);
      return wdFn({ data: { initData, amount: Number(amount), address: dest } });
    },
    onSuccess: () => { toast.success("طلب السحب اتسجل وهيتراجع"); setAmount(""); void refresh(); },
    onError: (e) => toast.error(animeErrorMessage(e)),
  });

  const p = price.data, up = (p?.change ?? 0) >= 0;
  const d = me.data;
  const usd = d && p ? d.balance * p.price : null;
  const left = d ? daysUntilWithdraw(d.joinedAt, now) : null;
  const claimable = d ? canClaimAnime(d.claimedAt, now) : false;

  return <section className="mt-6 space-y-3">
    <h2 className="text-xl font-extrabold">عملة ANIME</h2>
    <div className="glass rounded-3xl p-4">
      <div className="flex items-center justify-between">
        <div><p className="text-xs text-muted-foreground">سعر ANIME الآن</p>
          <p dir="ltr" className="mt-1 text-2xl font-extrabold tabular-nums">{p ? `$${p.price.toFixed(5)}` : "—"}</p></div>
        {p && <span className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold ${up ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
          {up ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}<span dir="ltr">{p.change.toFixed(2)}%</span></span>}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{p ? `1,000 ANIME ≈ $${(p.price * 1000).toFixed(2)}` : price.isError ? "تعذّر تحميل السعر" : "جارٍ تحميل السعر…"}</p>
      <div className="mt-3 border-t border-border pt-3">
        <p className="mb-2 text-xs text-muted-foreground">مدرجة على {ANIME_EXCHANGES.length} منصة</p>
        <a href={BINANCE} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-2xl bg-muted/50 px-4 py-3 font-bold">
          <span>Binance <span className="text-xs font-normal text-muted-foreground">ANIME/USDT</span></span><ExternalLink className="size-4" /></a>
        <div dir="ltr" className="mt-2 grid max-h-64 grid-cols-2 gap-1.5 overflow-y-auto">
          {ANIME_EXCHANGES.slice(1).map((x) => (
            <a key={x.name} href={x.url} target="_blank" rel="noreferrer" className="rounded-xl bg-muted/30 px-3 py-2 text-start">
              <span className="block truncate text-sm font-bold">{x.name}</span>
              <span className="block text-[0.65rem] text-muted-foreground">{x.pair}</span>
            </a>
          ))}
        </div>
      </div>
    </div>

    <div className="glass rounded-3xl p-4">
      <p className="text-xs text-muted-foreground">رصيد ANIME القابل للسحب</p>
      <p className="mt-1 text-3xl font-extrabold tabular-nums">{d ? formatAmount(d.balance) : "—"}</p>
      {usd !== null && <p dir="ltr" className="text-end text-xs text-muted-foreground">≈ ${usd.toFixed(2)}</p>}
      <p className="mt-2 text-sm">كل يوم بتعدّن ANIME على قد مستواك: <b>{d ? dailyAnime(d.level) : "—"}</b> في اليوم</p>
      <Button disabled={!d || !claimable || claim.isPending} onClick={() => claim.mutate()} className="btn-cta mt-3 w-full rounded-xl">
        {claimable ? "استلم ANIME النهارده" : "ارجع بكرة"}</Button>
    </div>

    <div className="glass rounded-3xl p-4">
      <h3 className="font-extrabold">السحب</h3>
      <p className="mt-1 text-xs text-muted-foreground">أقل سحب {formatAmount(ANIME_MIN_WITHDRAW)} ANIME، والسحب بيفتح بعد 30 يوم من دخولك.{left ? ` فاضل ${left} يوم.` : ""}</p>
      <Input dir="ltr" className="mt-3" placeholder={address ? "محفظتك المربوطة (أو اكتب عنوان تاني)" : "عنوان محفظة TON"} value={to} onChange={(e) => setTo(e.target.value)} />
      <Input dir="ltr" type="number" className="mt-2" placeholder="10000" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <Button variant="outline" className="mt-3 w-full rounded-xl"
        disabled={!d || wd.isPending || !canWithdraw(d.balance, d.joinedAt, now) || Number(amount) < ANIME_MIN_WITHDRAW || Number(amount) > d.balance || (!to.trim() && !address)}
        onClick={() => wd.mutate()}>اطلب السحب</Button>
      {d && d.withdrawals.length > 0 && <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
        {d.withdrawals.map((w) => <li key={w.id} className="flex justify-between"><span>{formatAmount(w.amount)} ANIME</span><span>{w.status === "pending" ? "قيد المراجعة" : w.status === "paid" ? "اتدفع" : w.status}</span></li>)}
      </ul>}
    </div>
  </section>;
}
