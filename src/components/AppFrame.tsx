import type { ReactNode } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Store, UserRound, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
    <header data-translation-pending={translationReady?undefined:''} className="app-toolbar sticky top-0 z-30 mx-auto flex max-w-md items-center justify-between gap-3 border-b border-border bg-background px-4">
      <Button asChild variant="ghost" size="icon" aria-label="الملف الشخصي" title="الملف الشخصي"><Link to="/profile"><UserRound className="size-5" /></Link></Button>
      <div className="flex min-w-0 items-center gap-4 text-sm font-semibold"><span className="flex items-center gap-1 text-accent"><Zap className="size-4" />{energy.data ? energyNow(energy.data,now) : '—'}</span><span className="truncate text-gold" dir="ltr">{player.data ? formatAmount(player.data.gram) : '—'} GRAM</span></div>
      <Button asChild variant="ghost" size="icon" aria-label="المتجر" title="المتجر"><Link to="/store"><Store className="size-5" /></Link></Button>
    </header>
    {group && <nav className="mx-auto flex max-w-md gap-2 border-b border-border px-4 py-2" aria-label="أقسام الفريق">{([{to:'/heroes',label:'الأبطال'},{to:'/squads',label:'التحالفات'},{to:'/duels',label:'التحديات'}] as const).map(t=><Button key={t.to} asChild size="sm" variant={path===t.to?'default':'ghost'} className="flex-1"><Link to={t.to}>{t.label}</Link></Button>)}</nav>}
    {children}
  </div>;
}