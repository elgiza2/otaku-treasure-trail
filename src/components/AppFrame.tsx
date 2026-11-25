import type { ReactNode } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Button } from '@/components/ui/button';
import { AnimatedEmoji } from '@/components/emoji/AnimatedEmoji';
import { getGrowthState } from '@/lib/growth.functions';
import { getEnergy } from '@/lib/game.functions';
import { energyNow } from '@/lib/game-model';
import { useTelegramInitData } from '@/lib/telegram';
import { useNow } from '@/components/tasks/use-now';
import { formatAmount } from '@/lib/coin';
import { useTranslationReady } from '@/i18n/DomTranslator';

export function AppFrame({ children }: { children: ReactNode }) {
  const translationReady=useTranslationReady();
  const path = useRouterState({ select: s => s.location.pathname });
  const initData = useTelegramInitData();
  const now = useNow(10_000);
  const load = useServerFn(getGrowthState);
  const loadEnergy = useServerFn(getEnergy);
  const visible = path !== '/' && path !== '/101' && !path.startsWith('/api/');
  const player = useQuery({ queryKey: ['wall-growth',initData,''], queryFn: () => load({data:{initData}}), enabled: visible && !!initData, staleTime: 30_000 });
  const energy = useQuery({ queryKey: ['wall-energy',initData], queryFn: () => loadEnergy({data:{initData}}), enabled: visible && !!initData, staleTime: 30_000 });
  if (!visible) return children;
  const group = ['/heroes','/squads','/duels'].includes(path);
  return <div className="clean-player">
    <header data-translation-pending={translationReady?undefined:''} className="app-toolbar sticky top-0 z-30 mx-auto flex max-w-md items-center justify-between gap-2 px-3.5 py-2">
      <Button asChild variant="ghost" size="icon" aria-label="الملف الشخصي" title="الملف الشخصي" className="glass size-10 rounded-full text-foreground hover:bg-foreground/10"><Link to="/profile"><AnimatedEmoji name="scout" className="size-5 text-foreground" /></Link></Button>
      <div className="flex min-w-0 items-center gap-2">
        <span className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold tabular-nums text-foreground"><AnimatedEmoji name="spark" className="size-4 text-accent" />{energy.data ? energyNow(energy.data,now) : '—'}</span>
        <span className="surface-gold flex min-w-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold tabular-nums text-gold" dir="ltr"><AnimatedEmoji name="gem" className="size-4 text-accent" /><span className="truncate">{player.data ? formatAmount(player.data.gram) : '—'} GRAM</span></span>
      </div>
      <Button asChild variant="ghost" size="icon" aria-label="المتجر" title="المتجر" className="surface-gold size-10 rounded-full text-accent hover:bg-accent/20"><Link to="/store"><AnimatedEmoji name="crystal" className="size-5 text-accent" /></Link></Button>
    </header>
    {group && <div className="mx-auto max-w-md px-4 pt-3"><nav className="glass grid grid-cols-3 gap-1 rounded-2xl p-1" aria-label="أقسام الفريق">{([{to:'/heroes',label:'الأبطال'},{to:'/squads',label:'التحالفات'},{to:'/duels',label:'التحديات'}] as const).map(t=><Link key={t.to} to={t.to} className={`rounded-xl py-2 text-center text-xs font-extrabold transition-colors ${path===t.to ? 'btn-cta' : 'text-muted-foreground hover:text-foreground'}`}>{t.label}</Link>)}</nav></div>}
    {children}
  </div>;
}