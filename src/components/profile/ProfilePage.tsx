import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import terrace from "@/assets/profile/garrison-terrace.jpg";
import avatar from "@/assets/heroes/hero-1-rage.jpg";
import { BottomNav } from "@/components/BottomNav";
import { AnimatedEmoji } from "@/components/emoji/AnimatedEmoji";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { detectLang, LANG_NAMES, LANGS, setLang, type Lang } from "@/i18n";
import { COIN, formatAmount, referralLink } from "@/lib/coin";
import { getHeroBoard } from "@/lib/heroes.functions";
import { totalRate, TOTAL_MAX } from "@/lib/heroes-model";
import { getMyProfile } from "@/lib/profile.functions";
import { useTelegramInitData, shareLink } from "@/lib/telegram";
import { MinePassCard, VerifiedBadge } from "./MinePassCard";

export function ProfilePage() {
  const [lang, setLangState] = useState<Lang>("ar");
  useEffect(() => setLangState(detectLang()), []);
  const initData = useTelegramInitData();
  const [tab, setTab] = useState<"team" | "leaders">("team");
  const [page, setPage] = useState(0);
  const [infoOpen, setInfoOpen] = useState(false);
  const profileFn = useServerFn(getMyProfile);
  const heroFn = useServerFn(getHeroBoard);
  const account = useQuery({ queryKey: ["wall-profile", initData, page], queryFn: () => profileFn({ data: { initData, page } }), enabled: !!initData });
  const board = useQuery({ queryKey: ["wall-heroes", initData], queryFn: () => heroFn({ data: { initData } }), enabled: !!initData });
  const p = account.data?.profile;
  const total = board.data?.levels.reduce((sum, level) => sum + level, 0);
  const rate = board.data ? totalRate(board.data.levels) : undefined;
  const teamCount = account.data?.teamCount;
  const days = p ? Math.max(1, Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400000) + 1) : undefined;
  const link = p ? referralLink(p.tg_id) : "";
  const guest = () => toast("افتح اللعبة من تيليجرام لعرض ملفك ودعوة أصدقائك");
  async function copy() {
    if (!link) { guest(); return; }
    try { await navigator.clipboard.writeText(link); toast.success("تم نسخ رابط دعوتك"); }
    catch { toast.error("تعذّر نسخ الرابط"); }
  }
  const team = account.data?.team ?? [];
  const leaders = board.data?.leaders ?? [];
  return <main className="relative mx-auto min-h-dvh max-w-md overflow-x-hidden pb-28">
    <div className="pointer-events-none absolute inset-x-0 top-0 h-[32rem] overflow-hidden" aria-hidden="true">
      <img src={terrace} width={720} height={1280} alt="" className="size-full object-cover object-[center_70%]" />
      <div className="profile-shade absolute inset-0" />
    </div>
    <div className="relative px-4 pt-6">
      <header className="animate-rise text-center">
        <p className="text-sm font-semibold text-foreground/80">الملف الشخصي</p>
        <div className="relative mx-auto mt-7 size-28">
          <img src={p?.photo_url || avatar} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = avatar; }} alt="صورة اللاعب" width={112} height={112} className="size-full rounded-full border-[3px] border-accent object-cover object-top shadow-lg" />
          <span className="absolute -bottom-2 start-1/2 -translate-x-[-50%] whitespace-nowrap rounded-full border-2 border-background bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">المستوى {total ?? "—"}</span>
        </div>
        <h1 className="mt-6 flex flex-wrap items-center justify-center gap-2 break-words text-3xl font-extrabold">{p?.first_name || p?.username || "جندي الحامية"}{board.data?.minePass && <VerifiedBadge />}</h1>
        {p?.username && <p dir="ltr" className="mt-1 text-sm font-medium text-accent">@{p.username}</p>}
        <p className="mt-2 text-sm text-foreground/80">حامية الأسوار <span className="mx-1 text-accent">·</span> {total === undefined ? "—" : `${total} / ${TOTAL_MAX}`}</p>
        {p && <p dir="ltr" className="mt-3 text-xs text-muted-foreground">ID #{p.tg_id}</p>}
      </header>
      <dl className="glass mt-6 grid grid-cols-4 divide-x divide-x-reverse divide-border rounded-2xl py-4 text-center">
        {[["قوة / ساعة", rate], ["الترتيب", board.data?.rank], ["المجندون", teamCount], ["الأيام", days]].map(([label, value]) => <div key={label} className="min-w-0 px-1"><dd className="break-words text-xl font-extrabold tabular-nums">{typeof value === "number" ? formatAmount(value) : "—"}</dd><dt className="mt-1 text-[11px] text-muted-foreground">{label}</dt></div>)}
      </dl>
      {!initData && <p className="mt-3 text-center text-xs text-muted-foreground">افتح اللعبة من تيليجرام لعرض بياناتك</p>}
      {initData && (account.isPending || board.isPending) && <p role="status" className="mt-3 text-center text-sm text-muted-foreground">جارٍ تحميل ملفك…</p>}
      {(account.isError || board.isError) && <div role="alert" className="mt-3 flex items-center justify-between gap-2 text-sm"><p>تعذّر تحميل بياناتك</p><Button variant="outline" onClick={() => { void account.refetch(); void board.refetch(); }}>إعادة المحاولة</Button></div>}
      <div className="mt-5"><MinePassCard initData={initData} /></div>

      <section className="mt-8">
        <div className="flex items-center justify-between"><h2 className="text-xl font-extrabold">ابنِ فريقك</h2><Button size="icon" variant="ghost" aria-label="عن دعوة الأصدقاء" title="عن دعوة الأصدقاء" onClick={() => setInfoOpen(true)} className="rounded-full border border-border text-accent">ⓘ</Button></div>
        <div className="profile-recruit mt-3 rounded-2xl p-5">
          <div className="flex items-center gap-3"><AnimatedEmoji name="scout" className="size-10 shrink-0 text-success" /><div><h3 className="text-lg font-extrabold">حاربوا معًا خلف الأسوار</h3><p className="mt-1 text-xs text-muted-foreground">فريقك {teamCount === undefined ? "—" : formatAmount(teamCount)} مجند</p></div></div>
          <div className="mt-5 flex items-center gap-2 border-y border-border py-3"><AnimatedEmoji name="gem" className="size-6 text-accent" /><span className="text-sm">مكافآت الإحالة من مهام الحامية</span><Button variant="link" asChild className="ms-auto px-0 text-success"><Link to="/tasks" search={{ c: "game" }}>المهام ←</Link></Button></div>
          <div className="mt-4 flex min-w-0 items-center gap-2 rounded-xl border border-border bg-background/40 p-2">
            <Button size="icon" variant="secondary" aria-label="نسخ رابط الدعوة" title="نسخ رابط الدعوة" onClick={copy} className="shrink-0 text-foreground">⧉</Button>
            <span dir="ltr" className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{link || "رابط دعوتك الشخصي"}</span>
          </div>
          <Button onClick={() => link ? shareLink(link, "انضم لفريقي خلف الأسوار، رقّي أبطالك وابدأ التعدين!") : guest()} className="btn-cta mt-3 h-12 w-full rounded-xl text-base font-bold"><AnimatedEmoji name="scout" className="size-6" />ادعُ أصدقاءك</Button>
        </div>
      </section>

      <section className="mt-6">
        <div role="tablist" aria-label="الفريق والمتصدرون" className="grid grid-cols-2 gap-1 rounded-xl bg-muted/50 p-1">
          <Button role="tab" aria-selected={tab === "team"} variant={tab === "team" ? "default" : "ghost"} onClick={() => setTab("team")} className="rounded-lg"><AnimatedEmoji name="scout" className="size-5" />فريقي {teamCount !== undefined ? `(${teamCount})` : ""}</Button>
          <Button role="tab" aria-selected={tab === "leaders"} variant={tab === "leaders" ? "default" : "ghost"} onClick={() => setTab("leaders")} className="rounded-lg"><AnimatedEmoji name="shields" className="size-5" />أفضل الأبطال</Button>
        </div>
        <div role="tabpanel" aria-label={tab === "team" ? "فريقي" : "أفضل الأبطال"} className="mt-3 space-y-2">
          {tab === "team" ? team.map((member, index) => <div key={`${member.created_at}-${index}`} className="glass flex items-center gap-3 rounded-2xl p-3"><img src={member.photo_url || avatar} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = avatar; }} alt="" loading="lazy" width={48} height={48} className="size-12 rounded-full object-cover object-top" /><div className="min-w-0 flex-1"><p className="truncate font-bold">{member.first_name || "مجند"}</p><p className="mt-1 text-xs text-muted-foreground">المستوى {member.total_level}</p></div><AnimatedEmoji name="scout" className="size-6 text-success" /></div>) : leaders.map((leader, index) => <div key={index} className="glass flex items-center gap-3 rounded-2xl p-3"><span className="w-5 shrink-0 text-center font-bold text-accent">{index + 1}</span><img src={leader.photo || avatar} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = avatar; }} alt="" loading="lazy" width={44} height={44} className="size-11 rounded-full object-cover object-top" /><p className="min-w-0 flex-1 truncate font-bold">{leader.name}{leader.me && <span className="ms-2 text-xs text-success">أنت</span>}</p><span className="text-sm font-bold tabular-nums text-accent">{leader.total}</span></div>)}
          {(tab === "team" ? team.length === 0 : leaders.length === 0) && <div className="py-8 text-center"><AnimatedEmoji name={tab === "team" ? "scout" : "shields"} className="mx-auto size-10 text-muted-foreground" /><p className="mt-3 text-sm text-muted-foreground">{!initData ? "فريقك وترتيبك يظهران داخل تيليجرام" : tab === "team" ? "لم ينضم أصدقاء بعد" : "لا توجد بيانات للمتصدرين بعد"}</p></div>}
          {tab === "team" && (teamCount ?? 0) > 20 && <div className="flex items-center justify-between pt-2"><Button variant="outline" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>السابق</Button><span className="text-xs text-muted-foreground">{page + 1}</span><Button variant="outline" disabled={(page + 1) * 20 >= (teamCount ?? 0)} onClick={() => setPage((value) => value + 1)}>التالي</Button></div>}
        </div>
      </section>
      <section className="mt-6 border-t border-border pt-5">
        <h2 className="mb-2 text-xl font-extrabold">الإعدادات</h2>
        <div className="flex items-center gap-3 border-b border-border py-4"><AnimatedEmoji name="globe" className="size-7 text-success" /><span className="flex-1 font-semibold">اللغة</span><select aria-label="اللغة" value={lang} onChange={(e) => setLang(e.target.value as Lang)} className="rounded-lg border border-border bg-card px-2 py-1 text-sm text-foreground">{LANGS.map((l) => <option data-no-tr key={l} value={l}>{LANG_NAMES[l]}</option>)}</select></div>
        <Button variant="ghost" asChild className="h-auto w-full justify-start gap-3 rounded-none border-b border-border px-0 py-4"><Link to="/"><AnimatedEmoji name="orbit" className="size-7 text-accent" /><span className="flex-1 text-start font-semibold">أعد مشاهدة القصة</span><span aria-hidden="true" className="text-muted-foreground">←</span></Link></Button>
      </section>
    </div>
    <Dialog open={infoOpen} onOpenChange={setInfoOpen}><DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-2xl pt-12"><DialogTitle className="text-start text-xl">ابنِ فريقك</DialogTitle><DialogDescription className="text-start leading-7">شارك رابطك الخاص. الأصدقاء الذين يفتحون اللعبة من خلاله يُضافون لفريقك. عند إكمال العدد المطلوب، استلم مكافأتك من صفحة المهام بعملة {COIN.symbol}.</DialogDescription><Button asChild className="btn-cta" onClick={() => setInfoOpen(false)}><Link to="/tasks" search={{ c: "game" }}>مكافآت الإحالة</Link></Button></DialogContent></Dialog>
    <BottomNav />
  </main>;
}