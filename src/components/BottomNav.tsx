import { Link, useRouterState } from "@tanstack/react-router";
import { AnimatedEmoji } from "@/components/emoji/AnimatedEmoji";
import type { EmojiName } from "@/components/emoji/emoji-registry";

const ITEMS: readonly { to: string; label: string; emoji: EmojiName }[] = [
  { to: '/battle', label: 'الحرب', emoji: 'shields' },
  { to: '/heroes', label: 'الفريق', emoji: 'scout' },
  { to: '/tasks', label: 'المهام', emoji: 'sparkle' },
  { to: '/raid', label: 'العجلة', emoji: 'orbit' },
  { to: '/wallet', label: 'المحفظة', emoji: 'wallet' },
] as const;

export function BottomNav() {
  const path=useRouterState({select:s=>s.location.pathname});
  return (
    <nav aria-label="التنقل الرئيسي" className="app-bottom-nav fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md justify-around gap-1 px-2 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))]">
      {ITEMS.map((i) => {
        const active = path===i.to || (i.to==='/heroes' && ['/squads','/duels'].includes(path));
        return (
          <Link key={i.to} to={i.to} aria-current={active ? 'page' : undefined} className={`flex h-13 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-bold transition-all duration-300 ease-[cubic-bezier(0.22,1.28,0.36,1)] active:scale-90 ${active ? 'bg-primary/22 text-foreground shadow-[inset_0_1px_0_oklch(1_0_0/0.24)]' : 'text-muted-foreground hover:text-foreground'}`}>
            <span className={`transition-transform duration-300 ease-[cubic-bezier(0.22,1.28,0.36,1)] ${active ? '-translate-y-0.5 scale-110' : ''}`}>
              <AnimatedEmoji name={i.emoji} className={`size-5 ${active ? 'text-accent' : 'text-foreground/75'}`} />
            </span>
            <span>{i.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
