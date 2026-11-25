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
    <nav aria-label="التنقل الرئيسي" className="app-bottom-nav fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-md justify-around rounded-[26px] px-1.5 py-1.5">
      {ITEMS.map((i) => {
        const active = path===i.to || (i.to==='/heroes' && ['/squads','/duels'].includes(path));
        return (
          <Link key={i.to} to={i.to} aria-current={active ? 'page' : undefined} className={`flex h-13 flex-1 flex-col items-center justify-center gap-0.5 rounded-[20px] text-[11px] font-bold transition-all ${active ? 'bg-foreground/14 text-accent shadow-[inset_0_1px_0_oklch(1_0_0/0.25)]' : 'text-foreground/70 hover:text-foreground'}`}>
            <AnimatedEmoji name={i.emoji} className={`size-5 ${active ? 'text-accent' : 'text-foreground/75'}`} />
            <span>{i.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
