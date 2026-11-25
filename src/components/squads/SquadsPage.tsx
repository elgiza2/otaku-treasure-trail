import { useEffect, useState } from "react";
import { queryOptions, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, LogOut, Plus, Search, Share2 } from "lucide-react";
import { toast } from "sonner";
import hallImage from "@/assets/tasks/garrison-hall.jpg";
import { BottomNav } from "@/components/BottomNav";
import { AnimatedEmoji } from "@/components/emoji/AnimatedEmoji";
import type { EmojiName } from "@/components/emoji/emoji-registry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { getMySquad, getSquadBoard, manageSquad } from "@/lib/game.functions";
import { gameError, squadLink, SQUAD_PRIZES, type Squad } from "@/lib/game-model";
import { formatAmount } from "@/lib/coin";
import { formatCountdown } from "@/lib/tournament-model";
import { shareLink, useTelegramInitData } from "@/lib/telegram";
import { useNow } from "@/components/tasks/use-now";
import { useTranslationReady } from "@/i18n/DomTranslator";
import { GrowthPanel } from '@/components/growth/GrowthPanel';
import { VerifiedBadge } from '@/components/profile/MinePassCard';

export const squadsQuery = queryOptions({ queryKey: ["wall-squads"], queryFn: () => getSquadBoard(), refetchInterval: 30_000 });
const EMBLEM_EMOJI: Record<string, EmojiName> = { "⚔️": "shields", "🛡️": "blocks", "🔥": "rays", "🐉": "rocket" };
const RANK_EMOJI: readonly EmojiName[] = ["gem", "crystal", "sparkle"];
export function SquadsPage({ invite }: { invite: string | undefined }) {
  const translationReady = useTranslationReady();
  const initData = useTelegramInitData();
  const qc = useQueryClient();
  const now = useNow(1000);
  const { data: board } = useSuspenseQuery(squadsQuery);
  const fetchMine = useServerFn(getMySquad);
  const mine = useQuery({ queryKey: ["wall-my-squad", initData], queryFn: () => fetchMine({ data: { initData } }), enabled: !!initData });
  const manage = useServerFn(manageSquad);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"current" | "previous">("current");
  const [open, setOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [bossOpen,setBossOpen]=useState(false);
  const [name, setName] = useState("");
  const [emblem, setEmblem] = useState<"⚔️" | "🛡️" | "🔥" | "🐉">("⚔️");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (mine.data) void qc.invalidateQueries({ queryKey: ["wall-squads"] }); }, [mine.data, qc]);
  const myTeam = board.squads.find((s) => s.id === mine.data?.squadId);
  const invited = board.squads.find((s) => s.id === invite);
  const rows = (tab === "current" ? board.squads : board.previous).filter((s) => s.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  async function act(action: "create" | "join" | "leave", squadId?: string) {
    if (!initData) { toast("افتح اللعبة من تيليجرام عشان تنضم للتحالف"); return; }
    setBusy(true);
    try {
      await manage({ data: { initData, action, ...(squadId ? { squadId } : {}), ...(action === "create" ? { name, emblem } : {}) } });
      await qc.invalidateQueries(); setOpen(false); setLeaveOpen(false);
      toast.success(action === "leave" ? "خرجت من التحالف" : "بقيت عضو في التحالف");
    } catch (e) { toast.error(gameError(e)); } finally { setBusy(false); }
  }
  function inviteTeam(squad: Squad) { shareLink(squadLink(squad.id), `انضم لتحالف ${squad.name} في منجم الأسوار!`); }
  async function copyTeam(squad: Squad) { try { await navigator.clipboard.writeText(squadLink(squad.id)); toast.success("تم نسخ رابط الدعوة"); } catch { toast.error("تعذّر نسخ الرابط"); } }
  function teamRow(squad: Squad, showJoin = true) {
    return <article key={squad.id} className="glass-card flex items-center gap-3 rounded-2xl p-3">
      <span className="w-5 shrink-0 text-xs text-muted-foreground">#{squad.rank}</span>
      <span className="glass grid size-11 shrink-0 place-items-center rounded-2xl"><AnimatedEmoji name={EMBLEM_EMOJI[squad.emblem] ?? "shields"} className="size-6 text-accent" /></span>
      <div className="min-w-0 flex-1"><h3 className="break-words text-sm font-bold">{squad.name}</h3><p className="flex items-center gap-1 text-xs text-muted-foreground"><AnimatedEmoji name="scout" className="size-3.5 text-muted-foreground" />{squad.members} أعضاء</p><p className="text-xs text-accent">{formatAmount(squad.points)} نقطة</p></div>
      <div className="flex shrink-0 flex-col items-end gap-1">{squad.prize > 0 && <span dir="ltr" className="text-xs font-bold text-gold">{squad.prize} GRAM</span>}{squad.id === myTeam?.id ? <span className="text-xs text-success">تحالفك</span> : showJoin && <Button size="sm" variant="outline" disabled={busy || !!mine.data?.squadId || (!!initData && mine.isPending)} onClick={() => act("join", squad.id)}>انضم</Button>}</div>
    </article>;
  }
  return <main data-translation-pending={translationReady ? undefined : ""} className="relative mx-auto min-h-dvh max-w-md overflow-x-hidden bg-background pb-28">
    <div className="pointer-events-none absolute inset-x-0 top-0 h-80 overflow-hidden"><img src={hallImage} alt="" className="size-full object-cover object-top" /><div className="hero-fade absolute inset-0" /></div>
    <div className="relative px-4 pt-12">
      <header className="text-center"><AnimatedEmoji name="gem" className="mx-auto size-10 text-accent" /><h1 className="mt-2 font-display text-3xl font-extrabold text-gold">دوري التحالفات</h1><p className="mt-2 text-xl font-bold text-gold" dir="ltr">10 GRAM</p><p className="text-xs text-muted-foreground">جوائز أسبوعية للتحالفات الثلاثة الأولى</p><p className="mt-2 text-sm tabular-nums">{formatCountdown(Date.parse(board.endsAt), now)}</p></header>
      <div className="glass-card mt-4 grid grid-cols-3 rounded-2xl py-3 text-center">{SQUAD_PRIZES.map((prize, i) => <div key={prize} className="flex flex-col items-center gap-1"><AnimatedEmoji name={RANK_EMOJI[i] ?? "sparkle"} className="size-6 text-accent" /><p className="text-sm font-bold text-gold" dir="ltr">{prize} GRAM</p></div>)}</div>
      <p className="mt-2 text-center text-xs text-muted-foreground">جائزة التحالف تتقسم بين أعضائه المشاركين</p>
      {!initData && <p className="mt-5 text-center text-sm text-muted-foreground">افتح اللعبة من تيليجرام عشان تنضم للتحالف</p>}
      {mine.isError && <p role="alert" className="mt-4 text-sm text-destructive">تعذّر تحميل تحالفك</p>}
      {myTeam && <section className="mt-5 space-y-2"><h2 className="font-bold">تحالفك</h2>{teamRow(myTeam, false)}<div className="flex gap-2"><Button className="flex-1" onClick={() => inviteTeam(myTeam)}><Share2 /> دعوة الأصدقاء</Button><Button variant="outline" size="icon" aria-label="نسخ رابط الدعوة" onClick={() => copyTeam(myTeam)}><Copy /></Button><Button variant="ghost" size="icon" aria-label="الخروج من التحالف" disabled={busy} onClick={() => setLeaveOpen(true)}><LogOut /></Button></div></section>}
      {invited && invited.id !== myTeam?.id && <section className="mt-5 space-y-2"><h2 className="font-bold">دعوة للتحالف</h2>{teamRow(invited)}</section>}
      {!mine.data?.squadId && <Button className="mt-5 w-full" onClick={() => { if (!initData) toast("افتح اللعبة من تيليجرام عشان تنضم للتحالف"); else setOpen(true); }}><Plus /> إنشاء تحالف</Button>}
      {myTeam && <><Button className="mt-4 w-full" variant="outline" onClick={()=>setBossOpen(true)}>زعيم التحالف الأسبوعي</Button><section className="glass-card mt-4 rounded-2xl p-4"><h3 className="text-sm font-bold">أعضاء التحالف</h3><div className="mt-3 divide-y divide-border">{mine.data?.members.map((member,index)=><div key={index} className="flex items-center gap-2 py-3 text-sm"><span className="min-w-0 flex-1 truncate">{member.name}</span>{member.verified && <VerifiedBadge />}</div>)}</div></section></>}
      <div className="glass mt-6 grid grid-cols-2 gap-1 rounded-2xl p-1" role="tablist" aria-label="دوري التحالفات"><Button role="tab" aria-selected={tab === "current"} variant="ghost" className={`rounded-xl ${tab === "current" ? "btn-cta" : "text-muted-foreground"}`} onClick={() => setTab("current")}>الأسبوع الحالي</Button><Button role="tab" aria-selected={tab === "previous"} variant="ghost" className={`rounded-xl ${tab === "previous" ? "btn-cta" : "text-muted-foreground"}`} onClick={() => setTab("previous")}>الأسبوع السابق</Button></div>
      <label className="relative mt-3 block"><Search className="absolute start-3 top-3 size-4 text-muted-foreground" /><Input className="ps-9" aria-label="ابحث عن تحالف" placeholder="ابحث عن تحالف" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
      <div className="mt-3 space-y-2">{rows.map((s) => teamRow(s, tab === "current"))}{rows.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">مفيش تحالفات هنا لسه</p>}</div>
    </div>
    <Dialog open={open} onOpenChange={(v) => { if (!busy) setOpen(v); }}><DialogContent className="max-w-sm"><DialogTitle>إنشاء تحالف</DialogTitle><DialogDescription>اسم التحالف</DialogDescription><Input aria-label="اسم التحالف" maxLength={32} minLength={3} value={name} onChange={(e) => setName(e.target.value)} /><div className="flex gap-2" role="group" aria-label="شعار التحالف">{(["⚔️", "🛡️", "🔥", "🐉"] as const).map((icon) => <Button key={icon} variant={emblem === icon ? "default" : "outline"} aria-pressed={emblem === icon} onClick={() => setEmblem(icon)}><AnimatedEmoji name={EMBLEM_EMOJI[icon] ?? "shields"} className="size-5" /></Button>)}</div><Button disabled={busy || name.trim().length < 3} onClick={() => act("create")}>{busy ? "جارٍ الإنشاء…" : "إنشاء تحالف"}</Button></DialogContent></Dialog>
    <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}><DialogContent className="max-w-sm"><DialogTitle>الخروج من التحالف</DialogTitle><DialogDescription>تأكيد الخروج من التحالف؟</DialogDescription><Button variant="destructive" disabled={busy} onClick={() => act("leave")}>الخروج من التحالف</Button></DialogContent></Dialog>
    <BottomNav />
    <Dialog open={bossOpen} onOpenChange={setBossOpen}><DialogContent className="max-h-[85dvh] max-w-sm overflow-y-auto"><DialogTitle>زعيم التحالف</DialogTitle><DialogDescription>معركة أسبوعية لأعضاء التحالف</DialogDescription><GrowthPanel mode="boss" /></DialogContent></Dialog>
  </main>;
}