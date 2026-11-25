import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Link } from '@tanstack/react-router';
import { BadgeCheck, Bell, Check, ChevronLeft, Flame, Gift, Loader2, RotateCw, Share2, Shield, Swords, Ticket, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { getGrowthState, getPendingMicroPayments, runGrowthAction } from '@/lib/growth.functions';
import { BOSS_HP, CHEST_INTERVAL_MS, MICRO_PACKS, chestReady, dailyExtras, duelLink, findMicroPack, growthError, type GrowthAction } from '@/lib/growth-model';
import { formatAmount, referralLink } from '@/lib/coin';
import { checkinState } from '@/lib/tasks-model';
import { formatCountdown } from '@/lib/tournament-model';
import { showAdsgramAd } from '@/lib/adsgram';
import { showRewardedAd } from '@/lib/monetag';
import { checkTonPayment, createTonPayment } from '@/lib/shop.functions';
import { shopErrorMessage } from '@/lib/shop-model';
import { getTonConnect } from '@/lib/ton-connect';
import { requestBotWriteAccess, shareGameStory, shareLink, useTelegramInitData } from '@/lib/telegram';
import { useNow } from '@/components/tasks/use-now';
import chestArt from '@/assets/onboarding/v3-2-mine.jpg';
import bossArt from '@/assets/heroes/hero-1-rage.jpg';

export type GrowthMode = 'daily' | 'referrals' | 'chest' | 'boss' | 'duels' | 'shop' | 'settings';
export function GrowthPanel({ mode, invite }: { mode: GrowthMode; invite?: string }) {
  const initData = useTelegramInitData();
  const now = useNow(1000);
  const qc = useQueryClient();
  const load = useServerFn(getGrowthState);
  const run = useServerFn(runGrowthAction);
  const createPayment = useServerFn(createTonPayment);
  const checkPayment = useServerFn(checkTonPayment);
  const pendingPayments = useServerFn(getPendingMicroPayments);
  const q = useQuery({ queryKey: ['wall-growth', initData, invite ?? ''], queryFn: () => load({ data: { initData, ...(invite ? { invite } : {}) } }), enabled: !!initData, staleTime: 15_000 });
  const payments = useQuery({ queryKey: ['wall-micro-pending', initData], queryFn: () => pendingPayments({ data: { initData } }), enabled: !!initData && mode === 'shop' });
  const s = q.data;
  const [busy, setBusy] = useState(false);
  const [lastDuel, setLastDuel] = useState<string | null>(null);
  const retry = useRef<{ action: GrowthAction; id: string; provider: 'adsgram' | 'monetag'; target?: string } | null>(null);
  async function refresh() { await qc.invalidateQueries(); }
  async function act(action: GrowthAction, provider?: 'adsgram' | 'monetag', target?: string) {
    if (!initData) { toast('افتح اللعبة من تيليجرام عشان تستلم المكافآت'); return; }
    if (busy) return;
    setBusy(true);
    try {
      let requestId = crypto.randomUUID();
      const pending = retry.current;
      if (pending) { action = pending.action; provider = pending.provider; target = pending.target; requestId = pending.id; }
      else if (provider) {
        if (provider === 'adsgram') await showAdsgramAd(); else await showRewardedAd();
        retry.current = { action, id: requestId, provider, ...(target ? { target } : {}) };
      }
      const r = await run({ data: { initData, action, requestId, ...(provider ? { provider } : {}), ...(target ? { target } : {}) } });
      retry.current = null;
      if (r.id) { setLastDuel(r.id); toast.success('التحدي جاهز'); }
      else if (r.hp !== undefined) toast.success(r.hp === 0 ? 'الزعيم اتهزم! +1,000 نقطة للتحالف' : `الضربة: ${r.damage} ضرر`);
      else if (r.won !== undefined) toast(r.won ? 'كسبت التحدي! +40 ANIME' : 'خسرت الجولة؛ تقدر تسترجع نصف العملات بإعلان');
      else if (r.gram !== undefined) toast.success(`+${r.gram} GRAM`);
      else if (r.reward || r.amount) toast.success(`+${r.reward ?? r.amount} ANIME`);
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (['chest_wait','no_revenge','boss_defeated','no_squad','bad_provider'].some(k => msg.includes(k))) retry.current = null;
      toast.error(msg.includes('ad_unavailable') ? 'مفيش إعلان متاح، جرّب الشبكة التانية' : msg.includes('ad_skipped') ? 'الإعلان ما اكتملش' : growthError(e));
    } finally { setBusy(false); }
  }
  async function confirm(id: string) {
    if (busy) return;
    setBusy(true);
    try { await checkPayment({ data: { initData, id } }); toast.success('تم تأكيد الشراء وإضافة الحزمة'); await refresh(); }
    catch (e) { toast.error(shopErrorMessage(e)); }
    finally { setBusy(false); }
  }
  async function buy(pack: string) {
    if (!initData) { toast('افتح اللعبة من تيليجرام عشان تشتري'); return; }
    if (busy) return;
    setBusy(true);
    try {
      const ui = await getTonConnect();
      if (!ui.connected) { await ui.openModal(); return; }
      const p = await createPayment({ data: { initData, pack } });
      await payments.refetch();
      await ui.sendTransaction({ validUntil: Math.floor(Date.now()/1000)+600, messages: [{ address: p.address, amount: p.amount, payload: p.payload }] });
      toast('الدفعة اتبعتت؛ التأكيد ممكن ياخد دقيقة');
      for (let i=0;i<12;i++) {
        await new Promise(resolve => setTimeout(resolve,5000));
        try { await checkPayment({ data: { initData, id: p.id } }); toast.success('تم تأكيد الشراء وإضافة الحزمة'); await refresh(); return; }
        catch (e) { if (!(e instanceof Error && e.message.includes('not_found_yet'))) throw e; }
      }
    } catch (e) { toast.error(shopErrorMessage(e)); }
    finally { setBusy(false); }
  }
  const ads = (action: GrowthAction, target?: string) => <div className="grid grid-cols-2 gap-2"><Button variant="outline" disabled={busy} onClick={() => act(action, 'adsgram', target)}>Adsgram</Button><Button variant="outline" disabled={busy} onClick={() => act(action, 'monetag', target)}>Monetag</Button></div>;
  const stateNotice = <>{!initData && <p className="py-3 text-sm text-muted-foreground">افتح اللعبة من تيليجرام عشان تستلم المكافآت</p>}{!!initData && q.isPending && <p role="status" className="flex items-center gap-2 py-3 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> جارٍ التحميل…</p>}{q.isError && <div role="alert" className="flex items-center justify-between py-3"><span className="text-sm text-destructive">تعذّر تحميل المكافآت</span><Button variant="ghost" size="icon" aria-label="إعادة المحاولة" onClick={() => q.refetch()}><RotateCw /></Button></div>}</>;
  const streak = checkinState(s?.streak ?? 0, s?.lastCheckinAt ?? null, now);
  const ready = chestReady(s?.chestAt ?? null, now);

  return <section className="space-y-4" aria-busy={busy}>
    {stateNotice}
    {retry.current && <Button variant="outline" className="w-full" disabled={busy} onClick={() => { const p=retry.current; if(p) void act(p.action,p.provider,p.target); }}><RotateCw /> استلام مكافأة الإعلان السابق</Button>}
    {mode === 'daily' && <>
      <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-lg font-bold"><Flame className="size-5 text-accent" /> سلسلة 7 أيام</h2><span className="text-xs text-muted-foreground">{s?.streak ?? 0} / 7</span></div>
      <div className="grid grid-cols-7 gap-1.5">{Array.from({length:7},(_,i)=>i+1).map(day => <div key={day} className={`flex min-h-24 flex-col items-center justify-center gap-1 rounded-lg border text-center ${day<=streak.doneDays ? 'border-success/40 bg-success/10' : day===streak.nextDay ? 'border-accent bg-accent/10' : 'border-border bg-card'}`}><span className="text-[10px] text-muted-foreground">يوم {day}</span>{day<=streak.doneDays ? <Check className="size-4 text-success" /> : day===7 ? <Ticket className="size-4 text-accent" /> : <Zap className="size-4 text-accent" />}<span className="text-xs font-bold">+{4+day}</span><span className="text-[10px] text-muted-foreground">⚡{dailyExtras(day).energy}</span></div>)}</div>
      <p className="text-xs text-muted-foreground">اليوم السابع: 11 ANIME + 35 طاقة + لفة إضافية</p>
      <Button className="h-12 w-full" disabled={busy || (!!s && !streak.claimable)} onClick={() => act('daily')}><Gift />{s && !streak.claimable ? 'استلمت مكافأة اليوم' : 'استلم مكافأة اليوم'}</Button>
    </>}
    {mode === 'chest' && <>
      <img src={chestArt} alt="خزينة منجم الأسوار" className="aspect-[16/7] w-full rounded-lg object-cover" />
      <h2 className="text-lg font-bold">صندوق المفاجآت</h2>
      <p className="text-sm text-muted-foreground">15–50 ANIME · صندوق كل 8 ساعات</p>
      {!ready && s?.chestAt ? <p className="py-4 text-center tabular-nums text-accent">{formatCountdown(Date.parse(s.chestAt)+CHEST_INTERVAL_MS,now)}</p> : <><Button className="h-12 w-full" disabled={busy} onClick={()=>act('chest')}><Gift /> افتح مجاناً</Button><p className="text-center text-xs text-muted-foreground">أو ضاعف جائزة الصندوق بإعلان</p>{ads('chest_ad')}</>}
    </>}
    {mode === 'referrals' && <>
      <div className="flex items-center justify-between border-b border-border pb-4"><div><h2 className="text-lg font-bold">مكافآت الأصدقاء</h2><p className="mt-1 text-xs text-muted-foreground">1 GRAM لكل 100 صديق موثق</p></div><span className="text-2xl font-bold text-accent">{s?.referrals ?? 0}</span></div>
      <progress aria-label="تقدم الإحالات الموثقة" max={100} value={(s?.referrals ?? 0)%100} className="h-2 w-full accent-accent" />
      <div className="flex justify-between text-xs text-muted-foreground"><span>{(s?.referrals ?? 0)%100} / 100</span><span dir="ltr">{s?.milestones ?? 0} GRAM</span></div>
      <p className="text-xs text-muted-foreground">توثيق كل صديق بـ0.05 TON · المكافأة بتضاف تلقائياً</p>
      <Button className="h-12 w-full" onClick={()=>s ? shareLink(referralLink(s.tgId),'العب معايا في منجم الأسوار!') : toast('افتح اللعبة من تيليجرام')}><Share2 /> ادعُ أصدقاءك</Button>
      <Button variant="outline" className="w-full" onClick={()=>s ? shareGameStory(referralLink(s.tgId)) : toast('افتح اللعبة من تيليجرام')}><Share2 /> شارك الستوري</Button>
      <Link to="/tournament" className="flex items-center justify-between border-t border-border pt-4 text-sm"><span>المسابقة الأسبوعية · 350 GRAM</span><ChevronLeft className="size-4 text-accent" /></Link>
    </>}
    {mode === 'boss' && <>
      <img src={bossArt} alt="زعيم التحالف الأسبوعي" className="aspect-[16/8] w-full rounded-lg object-cover object-top" />
      <h2 className="text-lg font-bold">زعيم التحالف</h2>
      {!s?.squadId ? <Button asChild variant="outline" className="w-full"><Link to="/squads">انضم لتحالف</Link></Button> : <>
        <div className="flex justify-between text-sm"><span>صحة الزعيم</span><b className="text-destructive">{formatAmount(s.bossHp)} / {formatAmount(BOSS_HP)}</b></div><progress className="h-2 w-full accent-destructive" max={BOSS_HP} value={s.bossHp} aria-label="صحة الزعيم" />
        <p className="text-xs text-muted-foreground">هزيمة الزعيم: 1,000 نقطة للتحالف · يتجدد أسبوعياً</p>
        <p className="text-xs tabular-nums text-muted-foreground">{formatCountdown(Date.parse(s.bossEndsAt),now)}</p>
        {s.bossHp>0 ? <><Button className="h-12 w-full" disabled={busy} onClick={()=>act('boss')}><Swords /> هجوم · 20 طاقة</Button><p className="text-center text-xs text-muted-foreground">ضربة حرجة بإعلان · 500 ضرر</p>{ads('boss_ad')}<Button className="w-full" variant="outline" disabled={busy || s.bossStrikes<1} onClick={()=>act('boss_paid')}>ضربة قوية · {s.bossStrikes} تذاكر</Button><Button asChild variant="link" className="w-full"><Link to="/store">تذكرة ضربة بـ0.05 TON</Link></Button></> : <p className="py-4 text-center font-bold text-success">الزعيم اتهزم!</p>}
      </>}
    </>}
    {mode === 'duels' && <>
      <p className="text-sm text-muted-foreground">تحدي 20 ANIME لكل لاعب · الفائز يستلم 40 ANIME · فرص الفوز متساوية</p>
      {s?.invite && s.invite.status==='pending' && Date.parse(s.invite.expiresAt)>now && !s.invite.mine && <div className="space-y-3 border-y border-accent/30 py-4"><p className="font-bold">تحدي من {s.invite.name}</p><Button className="w-full" disabled={busy} onClick={()=>act('duel_accept',undefined,s.invite?.id)}>اقبل التحدي · 20 ANIME</Button></div>}
      {s?.invite && (s.invite.status!=='pending' || Date.parse(s.invite.expiresAt)<=now) && <p className="text-sm text-muted-foreground">التحدي انتهى أو اتلعب بالفعل</p>}
      <Button className="h-12 w-full" disabled={busy} onClick={()=>act('duel_create')}><Swords /> تحدى صديق</Button>
      {lastDuel && <Button className="w-full" variant="outline" onClick={()=>shareLink(duelLink(lastDuel),'تحدي منجم الأسوار ⚔️')}><Share2 /> ابعت رابط التحدي</Button>}
      {(s?.duels ?? []).map(d=><article key={d.id} className="space-y-3 rounded-lg border border-border bg-card p-4"><div className="flex justify-between"><p className="font-bold">{d.name || 'تحدي الأصدقاء'}</p><span className="text-xs text-muted-foreground">{d.status==='pending'?'في انتظار صديق':d.status==='cancelled'?'اتلغى ورجع رصيدك':d.won?'فوز':'خسارة'}</span></div>{d.status==='pending' && <><p className="text-xs tabular-nums text-muted-foreground">{formatCountdown(Date.parse(d.expiresAt),now)}</p><div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={()=>shareLink(duelLink(d.id),'تحدي منجم الأسوار')}><Share2 /> مشاركة</Button><Button variant="ghost" disabled={busy} onClick={()=>act('duel_cancel',undefined,d.id)}>إلغاء</Button></div></>}{d.status==='settled' && !d.won && !d.avenged && <><p className="text-xs text-muted-foreground">انتقام بإعلان · استرجع 10 ANIME</p>{ads('duel_revenge',d.id)}</>}</article>)}
    </>}
    {mode === 'shop' && <>
      {s?.boostUntil && Date.parse(s.boostUntil)>now && <p className="text-sm text-success">مضاعف التعدين نشط · {formatCountdown(Date.parse(s.boostUntil),now)}</p>}
      {s?.protectionUntil && Date.parse(s.protectionUntil)>now && <p className="text-sm text-success">الحماية نشطة · {formatCountdown(Date.parse(s.protectionUntil),now)}</p>}
      <div className="divide-y divide-border">{MICRO_PACKS.map(p=>{const Icon=p.icon==='energy'?Zap:p.icon==='spins'?Ticket:p.icon==='shield'?Shield:p.icon==='boost'?Flame:Swords;return <div key={p.id} className="flex items-center gap-3 py-4"><span className="grid size-11 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent"><Icon className="size-5" /></span><div className="min-w-0 flex-1"><h2 className="font-bold">{p.label}</h2><p className="mt-1 text-xs text-muted-foreground">{p.detail}</p></div><Button variant="outline" className="shrink-0" disabled={busy} onClick={()=>buy(p.id)}><span dir="ltr">{p.ton} TON</span></Button></div>})}</div>
      {(payments.data ?? []).map(p=><div key={p.id} className="flex items-center justify-between gap-2 border-t border-border py-3"><span className="text-xs text-muted-foreground">{findMicroPack(p.pack)?.label} · دفعة معلقة</span><Button variant="outline" size="sm" disabled={busy} onClick={()=>confirm(p.id)}><RotateCw /> تحقق</Button></div>)}
      <Button asChild variant="outline" className="w-full"><Link to="/wallet">المحفظة وباقي حزم العملات</Link></Button>
    </>}
    {mode === 'settings' && <div className="flex items-center justify-between border-y border-border py-4"><div><h2 className="flex items-center gap-2 font-bold"><Bell className="size-4 text-accent" /> تنبيهات اللعبة</h2><p className="mt-1 text-xs text-muted-foreground">امتلاء الطاقة والمسابقة الأسبوعية</p></div><Switch aria-label="تنبيهات اللعبة" checked={s?.notifications ?? false} disabled={busy || !s} onCheckedChange={v=>{if(v) requestBotWriteAccess();void act(v?'notify_on':'notify_off');}} /></div>}
    {mode === 'referrals' && s?.verified && <p className="flex items-center gap-2 text-xs text-gold"><BadgeCheck className="size-4" /> حساب موثق</p>}
  </section>;
}