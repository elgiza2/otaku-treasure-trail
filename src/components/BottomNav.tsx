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
    <nav aria-label="التنقل الرئيسي" className="app-bottom-nav fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-md justify-around rounded-[26px] px-1.5 py-1.5">
      {ITEMS.map((i) => {
        const active = path===i.to || (i.to==='/heroes' && ['/squads','/duels'].includes(path));
        return (
          <Link key={i.to} to={i.to} aria-current={active ? 'page' : undefined} className={`flex h-13 flex-1 flex-col items-center justify-center gap-0.5 rounded-[20px] text-[11px] font-bold transition-all ${active ? 'bg-accent/18 text-accent shadow-[inset_0_1px_0_oklch(1_0_0/0.15)]' : 'text-muted-foreground hover:text-foreground'}`}>
            <i.icon className="size-5" strokeWidth={active ? 2.2 : 1.75} />
            <span>{i.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
