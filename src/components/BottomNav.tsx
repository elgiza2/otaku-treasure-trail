import { Link, useRouterState } from "@tanstack/react-router";
import { ClipboardList, CircleDollarSign, Swords, UsersRound, Wallet } from 'lucide-react';

const ITEMS = [
  { to: '/battle', label: 'الحرب', icon: Swords },
  { to: '/heroes', label: 'الفريق', icon: UsersRound },
  { to: '/tasks', label: 'المهام', icon: ClipboardList },
  { to: '/raid', label: 'العجلة', icon: CircleDollarSign },
  { to: '/wallet', label: 'المحفظة', icon: Wallet },
] as const;

export function BottomNav() {
  const path=useRouterState({select:s=>s.location.pathname});
  return (
    <nav aria-label="التنقل الرئيسي" className="app-bottom-nav fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md justify-around border-t border-border bg-card px-2 pt-2">
      {ITEMS.map((i) => (
        <Link key={i.to} to={i.to} aria-current={path===i.to || (i.to==='/heroes' && ['/squads','/duels'].includes(path)) ? 'page' : undefined} className={`flex h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] ${path===i.to || (i.to==='/heroes' && ['/squads','/duels'].includes(path)) ? 'text-accent' : 'text-muted-foreground'}`}>
          <i.icon className="size-5" strokeWidth={1.8} />
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
