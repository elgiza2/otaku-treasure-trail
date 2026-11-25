import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Link } from '@tanstack/react-router';
import { Check, ChevronLeft, Loader2, RotateCw, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { AnimatedEmoji } from '@/components/emoji/AnimatedEmoji';
import type { EmojiName } from '@/components/emoji/emoji-registry';
import { VerifiedBadge } from '@/components/profile/MinePassCard';
import { getGrowthState, getPendingMicroPayments, runGrowthAction } from '@/lib/growth.functions';
import { BOSS_HP, CHEST_INTERVAL_MS, MICRO_PACKS, chestReady, dailyExtras, duelLink, findMicroPack, growthError, type GrowthAction } from '@/lib/growth-model';
import { formatAmount, referralLink } from '@/lib/coin';
import { checkinState } from '@/lib/tasks-model';
import { formatCountdown } from '@/lib/tournament-model';
import { showDualAd } from '@/lib/dual-ad';
import { checkTonPayment, createTonPayment } from '@/lib/shop.functions';
import { shopErrorMessage } from '@/lib/shop-model';
import { getTonConnect } from '@/lib/ton-connect';
import { requestBotWriteAccess, shareGameStory, shareLink, useTelegramInitData } from '@/lib/telegram';
import { useNow } from '@/components/tasks/use-now';
import chestArt from '@/assets/onboarding/v3-2-mine.jpg';
import bossArt from '@/assets/heroes/hero-1-rage.jpg';
import { useTranslationReady } from '@/i18n/DomTranslator';

export type GrowthMode = 'daily' | 'referrals' | 'chest' | 'boss' | 'duels' | 'shop' | 'settings';
export function GrowthPanel({ mode, invite }: { mode: GrowthMode; invite?: string }) {
  const translationReady=useTranslationReady();
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
  async function act(action: GrowthAction, useAd = false, target?: string) {
    if (!initData) { toast('افتح اللعبة من تيليجرام عشان تستلم المكافآت'); return; }
    if (busy) return;
    setBusy(true);
    try {
      let requestId: string = crypto.randomUUID();
      let provider: 'adsgram' | 'monetag' | undefined;
      const pending = retry.current;
      if (pending) { action = pending.action; provider = pending.provider; target = pending.target; requestId = pending.id; }
      else if (useAd) {
        provider = await showDualAd();
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
  const ads = (action: GrowthAction, target?: string) => <Button variant="outline" className="glass h-11 w-full rounded-2xl border-accent/35 font-display font-extrabold hover:bg-accent/15" disabled={busy} onClick={() => act(action, true, target)}><AnimatedEmoji name="sparkle" className="size-4 text-accent" /> شاهد إعلان</Button>;
  const stateNotice = <>{!initData && <p className="glass rounded-2xl px-4 py-2.5 text-center text-xs font-medium text-muted-foreground">افتح اللعبة من تيليجرام عشان تستلم المكافآت</p>}{!!initData && q.isPending && <p role="status" className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground"><Loader2 className="size-4 animate-spin text-accent" /> جارٍ التحميل…</p>}{q.isError && <div role="alert" className="glass flex items-center justify-between rounded-2xl px-4 py-2.5"><span className="text-xs text-destructive">تعذّر تحميل المكافآت</span><Button variant="ghost" size="icon" aria-label="إعادة المحاولة" onClick={() => q.refetch()}><RotateCw className="size-4" /></Button></div>}</>;
  const streak = checkinState(s?.streak ?? 0, s?.lastCheckinAt ?? null, now);
  const ready = chestReady(s?.chestAt ?? null, now);
  const refProgress = (s?.referrals ?? 0) % 100;

  return <section data-translation-pending={translationReady?undefined:''} className="space-y-4" aria-busy={busy}>
    {stateNotice}
    {retry.current && <Button variant="outline" className="h-11 w-full rounded-2xl border-accent/40" disabled={busy} onClick={() => { const p=retry.current; if(p) void act(p.action,true,p.target); }}><RotateCw className="size-4" /> استلام مكافأة الإعلان السابق</Button>}
    {mode === 'daily' && <div className="glass-card space-y-4 rounded-[1.75rem] p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="glass grid size-10 place-items-center rounded-2xl"><AnimatedEmoji name="rays" className="size-6 text-accent" /></span>
          <div><h2 className="font-display text-base font-extrabold">سلسلة 7 أيام</h2><p className="text-[11px] text-muted-foreground">اليوم السابع: 11 ANIME + 35 طاقة + لفة إضافية</p></div>
        </div>
        <span className="surface-gold shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold text-gold" dir="ltr">{s?.streak ?? 0} / 7</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
        <div className="bg-gold-bar h-full rounded-full transition-[width] duration-500" style={{ width: `${(streak.doneDays / 7) * 100}%` }} />
      </div>
      <div className="grid grid-cols-4 grid-rows-2 gap-2">
        {[1,2,3,4,5,6].map(day => {
          const done = day <= streak.doneDays;
          const active = day === streak.nextDay && streak.claimable;
          return <div key={day} className={`flex flex-col items-center justify-center gap-1 rounded-2xl border py-2.5 text-center transition-colors ${done ? 'border-success/45 bg-success/12' : active ? 'surface-gold border-accent/70' : 'glass'}`}>
            <span className={`text-[10px] font-semibold ${done ? 'text-success' : 'text-muted-foreground'}`}>يوم {day}</span>
            {done ? <Check className="size-4 text-success" /> : <AnimatedEmoji name="spark" className="size-4 text-accent" />}
            <span dir="ltr" className="font-display text-sm font-extrabold">+{4+day}</span>
            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground"><AnimatedEmoji name="ore" className="size-3 text-accent" />{dailyExtras(day).energy}</span>
          </div>;
        })}
        <div className={`col-start-4 row-span-2 row-start-1 flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-2 text-center ${7 <= streak.doneDays ? 'border-success/45 bg-success/12' : 'surface-gold'}`}>
          <span className="text-[10px] font-bold text-accent">يوم 7</span>
          <AnimatedEmoji name="gem" className="size-7 text-accent" />
          <span dir="ltr" className="font-display text-lg font-extrabold text-gold">+11</span>
          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-foreground/85"><AnimatedEmoji name="spark" className="size-3 text-accent" />35</span>
        </div>
      </div>
      <Button className="btn-cta h-12 w-full rounded-2xl font-display text-base font-extrabold" disabled={busy || (!!s && !streak.claimable)} onClick={() => act('daily')}><AnimatedEmoji name="sparkle" className="size-5 text-primary-foreground" />{s && !streak.claimable ? 'استلمت مكافأة اليوم' : 'استلم مكافأة اليوم'}</Button>
    </div>}
    {mode === 'chest' && <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl border border-accent/25">
        <img src={chestArt} alt="خزينة منجم الأسوار" className="aspect-[16/8] w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
        <div className="absolute inset-x-3 bottom-3 flex items-end justify-between">
          <div><h2 className="font-display text-lg font-extrabold text-gold">صندوق المفاجآت</h2><p className="text-xs text-foreground/85">15–50 ANIME · صندوق كل 8 ساعات</p></div>
        </div>
      </div>
      {!ready && s?.chestAt ? <p className="glass rounded-2xl py-4 text-center font-display text-lg font-extrabold tabular-nums text-accent">{formatCountdown(Date.parse(s.chestAt)+CHEST_INTERVAL_MS,now)}</p> : <><Button className="btn-cta h-12 w-full rounded-2xl font-display text-base font-extrabold" disabled={busy} onClick={()=>act('chest')}><AnimatedEmoji name="crystal" className="size-5 text-primary-foreground" /> افتح مجاناً</Button><p className="text-center text-xs text-muted-foreground">أو ضاعف جائزة الصندوق بإعلان</p>{ads('chest_ad')}</>}
    </div>}
    {mode === 'referrals' && <div className="space-y-4">
      <div className="surface-gold space-y-4 rounded-[1.75rem] p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-extrabold text-gold">مكافآت الأصدقاء</h2>
            <p className="mt-1 text-xs text-foreground/80">1 GRAM لكل 100 صديق موثق</p>
          </div>
          <span className="rounded-2xl bg-background/50 px-3.5 py-2 font-display text-2xl font-extrabold tabular-nums text-gold" dir="ltr">{s?.referrals ?? 0}</span>
        </div>
        <div>
          <div role="progressbar" aria-label="تقدم الإحالات الموثقة" aria-valuemin={0} aria-valuemax={100} aria-valuenow={refProgress} className="h-2.5 w-full overflow-hidden rounded-full bg-background/60">
            <div className="bg-gold-bar h-full rounded-full transition-[width] duration-500" style={{ width: `${refProgress}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-xs font-semibold text-foreground/80"><span dir="ltr">{refProgress} / 100</span><span className="text-gold" dir="ltr">{s?.milestones ?? 0} GRAM</span></div>
        </div>
        <p className="text-xs text-muted-foreground">توثيق كل صديق بـ0.05 TON · المكافأة بتضاف تلقائياً</p>
        {s?.verified && <p className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-gold"><VerifiedBadge /> حساب موثق</p>}
        <div className="grid grid-cols-1 gap-2 pt-1">
          <Button className="btn-cta h-12 w-full rounded-2xl font-display text-base font-extrabold" onClick={()=>s ? shareLink(referralLink(s.tgId),'العب معايا في منجم الأسوار!') : toast('افتح اللعبة من تيليجرام')}><Share2 className="size-4" /> ادعُ أصدقاءك</Button>
          <Button variant="outline" className="h-11 w-full rounded-2xl border-accent/30 bg-background/40 font-bold" onClick={()=>s ? shareGameStory(referralLink(s.tgId)) : toast('افتح اللعبة من تيليجرام')}><Share2 className="size-4 text-accent" /> شارك الستوري</Button>
        </div>
      </div>
      <Link to="/tournament" className="glass-card flex items-center justify-between rounded-3xl p-4 transition-transform active:scale-[0.99]">
        <span className="font-display text-sm font-extrabold text-gold">المسابقة الأسبوعية · 350 GRAM</span>
        <ChevronLeft className="size-5 text-accent" />
      </Link>
    </div>}
    {mode === 'boss' && <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl border border-destructive/40">
        <img src={bossArt} alt="زعيم التحالف الأسبوعي" className="aspect-[16/8] w-full object-cover object-top" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/35 to-transparent" />
        <div className="absolute inset-x-3 bottom-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-extrabold">زعيم التحالف</h2>
          {s && <span className="rounded-full bg-background/70 px-2.5 py-1 text-[11px] font-bold tabular-nums text-accent">{formatCountdown(Date.parse(s.bossEndsAt),now)}</span>}
        </div>
      </div>
      {!s?.squadId ? <Button asChild variant="outline" className="h-12 w-full rounded-2xl"><Link to="/squads">انضم لتحالف</Link></Button> : <>
        <div className="glass-card space-y-2 rounded-2xl p-3.5">
          <div className="flex justify-between text-xs font-bold"><span>صحة الزعيم</span><b className="tabular-nums text-destructive" dir="ltr">{formatAmount(s.bossHp)} / {formatAmount(BOSS_HP)}</b></div>
          <div role="progressbar" aria-label="صحة الزعيم" aria-valuemin={0} aria-valuemax={BOSS_HP} aria-valuenow={s.bossHp} className="h-2.5 w-full overflow-hidden rounded-full bg-background/60">
            <div className="h-full rounded-full bg-destructive transition-[width] duration-500" style={{ width: `${(s.bossHp / BOSS_HP) * 100}%` }} />
          </div>
          <p className="text-[11px] text-muted-foreground">هزيمة الزعيم: 1,000 نقطة للتحالف · يتجدد أسبوعياً</p>
        </div>
        {s.bossHp>0 ? <div className="space-y-2.5"><Button className="btn-cta h-12 w-full rounded-2xl font-display text-base font-extrabold" disabled={busy} onClick={()=>act('boss')}><AnimatedEmoji name="shields" className="size-5 text-primary-foreground" /> هجوم · 20 طاقة</Button><p className="text-center text-xs text-muted-foreground">ضربة حرجة بإعلان · 500 ضرر</p>{ads('boss_ad')}<Button className="glass h-11 w-full rounded-2xl border-accent/30" variant="outline" disabled={busy || s.bossStrikes<1} onClick={()=>act('boss_paid')}>ضربة قوية · {s.bossStrikes} تذاكر</Button><Button asChild variant="link" className="w-full text-accent"><Link to="/store">تذكرة ضربة بـ0.05 TON</Link></Button></div> : <p className="glass rounded-2xl py-4 text-center font-display text-base font-extrabold text-success">الزعيم اتهزم!</p>}
      </>}
    </div>}
    {mode === 'duels' && <div className="space-y-4">
      <div className="surface-gold space-y-3 rounded-[1.75rem] p-5 text-center">
        <span className="glass mx-auto grid size-12 place-items-center rounded-2xl"><AnimatedEmoji name="shields" className="size-7 text-accent" /></span>
        <p className="text-xs leading-relaxed text-foreground/85">تحدي 20 ANIME لكل لاعب · الفائز يستلم 40 ANIME · فرص الفوز متساوية</p>
        <Button className="btn-cta h-12 w-full rounded-2xl font-display text-base font-extrabold" disabled={busy} onClick={()=>act('duel_create')}><AnimatedEmoji name="rocket" className="size-5 text-primary-foreground" /> تحدى صديق</Button>
        {lastDuel && <Button className="glass h-11 w-full rounded-2xl border-accent/30" variant="outline" onClick={()=>shareLink(duelLink(lastDuel),'تحدي منجم الأسوار')}><Share2 className="size-4 text-accent" /> ابعت رابط التحدي</Button>}
      </div>
      {s?.invite && s.invite.status==='pending' && Date.parse(s.invite.expiresAt)>now && !s.invite.mine && <div className="glass-card space-y-3 rounded-3xl border-accent/40 p-4"><p className="font-display font-extrabold text-gold">تحدي من {s.invite.name}</p><Button className="btn-cta h-11 w-full rounded-2xl font-bold" disabled={busy} onClick={()=>act('duel_accept',false,s.invite?.id)}>اقبل التحدي · 20 ANIME</Button></div>}
      {s?.invite && (s.invite.status!=='pending' || Date.parse(s.invite.expiresAt)<=now) && <p className="glass rounded-2xl p-3 text-center text-xs text-muted-foreground">التحدي انتهى أو اتلعب بالفعل</p>}
      {(s?.duels ?? []).map(d=><article key={d.id} className="glass-card space-y-3 rounded-3xl p-4"><div className="flex items-center justify-between gap-2"><p className="font-bold">{d.name || 'تحدي الأصدقاء'}</p><span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${d.status==='settled' && d.won ? 'bg-success/15 text-success' : d.status==='settled' ? 'bg-destructive/15 text-destructive' : 'bg-accent/15 text-accent'}`}>{d.status==='pending'?'في انتظار صديق':d.status==='cancelled'?'اتلغى ورجع رصيدك':d.won?'فوز':'خسارة'}</span></div>{d.status==='pending' && <><p className="text-xs tabular-nums text-muted-foreground">{formatCountdown(Date.parse(d.expiresAt),now)}</p><div className="flex gap-2"><Button variant="outline" className="h-10 flex-1 rounded-2xl border-accent/30" onClick={()=>shareLink(duelLink(d.id),'تحدي منجم الأسوار')}><Share2 className="size-4" /> مشاركة</Button><Button variant="ghost" className="h-10 rounded-2xl" disabled={busy} onClick={()=>act('duel_cancel',false,d.id)}>إلغاء</Button></div></>}{d.status==='settled' && !d.won && !d.avenged && <><p className="text-xs text-muted-foreground">انتقام بإعلان · استرجع 10 ANIME</p>{ads('duel_revenge',d.id)}</>}</article>)}
    </div>}
    {mode === 'shop' && <div className="space-y-3">
      {s?.boostUntil && Date.parse(s.boostUntil)>now && <p className="glass rounded-2xl px-4 py-2.5 text-center text-xs font-bold text-success">مضاعف التعدين نشط · {formatCountdown(Date.parse(s.boostUntil),now)}</p>}
      {s?.protectionUntil && Date.parse(s.protectionUntil)>now && <p className="glass rounded-2xl px-4 py-2.5 text-center text-xs font-bold text-success">الحماية نشطة · {formatCountdown(Date.parse(s.protectionUntil),now)}</p>}
      <div className="space-y-2.5">{MICRO_PACKS.map(p=>{const emoji:EmojiName=p.icon==='energy'?'spark':p.icon==='spins'?'orbit':p.icon==='shield'?'shields':p.icon==='boost'?'rays':'rocket';return <article key={p.id} className="glass-card flex items-center gap-3.5 rounded-3xl p-4"><span className="glass grid size-12 shrink-0 place-items-center rounded-2xl"><AnimatedEmoji name={emoji} className="size-6 text-accent" /></span><div className="min-w-0 flex-1"><h2 className="font-display text-sm font-extrabold">{p.label}</h2><p className="mt-0.5 text-xs text-muted-foreground">{p.detail}</p></div><Button className="btn-cta h-10 shrink-0 rounded-2xl px-4 font-display text-xs font-extrabold" disabled={busy} onClick={()=>buy(p.id)}><span dir="ltr">{p.ton} TON</span></Button></article>})}</div>
      {(payments.data ?? []).map(p=><div key={p.id} className="glass flex items-center justify-between gap-2 rounded-2xl px-4 py-3"><span className="text-xs text-muted-foreground">{findMicroPack(p.pack)?.label} · دفعة معلقة</span><Button variant="outline" size="sm" className="rounded-xl" disabled={busy} onClick={()=>confirm(p.id)}><RotateCw className="size-3.5" /> تحقق</Button></div>)}
      <Button asChild variant="outline" className="glass h-12 w-full rounded-2xl border-border font-bold"><Link to="/wallet">المحفظة وباقي حزم العملات</Link></Button>
    </div>}
    {mode === 'settings' && <div className="glass-card flex items-center justify-between rounded-3xl p-4"><div className="flex items-center gap-3"><span className="glass grid size-10 place-items-center rounded-2xl"><AnimatedEmoji name="globe" className="size-5 text-accent" /></span><div><h2 className="font-bold">تنبيهات اللعبة</h2><p className="mt-0.5 text-xs text-muted-foreground">امتلاء الطاقة والمسابقة الأسبوعية</p></div></div><Switch aria-label="تنبيهات اللعبة" checked={s?.notifications ?? false} disabled={busy || !s} onCheckedChange={v=>{if(v) requestBotWriteAccess();void act(v?'notify_on':'notify_off');}} /></div>}
  </section>;
}