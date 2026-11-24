import { useState } from "react";
import { detectLang, RTL, trf } from "@/i18n";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Lightbulb, Send, Type, Users, Zap } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { COIN, formatAmount } from "@/lib/coin";
import { answerStory, getStory, spendStoryItem } from "@/lib/story.functions";
import { COMMUNITY_URL, FIRST_SOLVER_BONUS, FIRST_SOLVERS, FREE_TRIES, STORY_ITEMS } from "@/lib/story-model";
import { checkTonPayment, createTonPayment } from "@/lib/shop.functions";
import { shopErrorMessage } from "@/lib/shop-model";
import { haptic } from "@/lib/telegram";
import { getTonConnect } from "@/lib/ton-connect";
import dawn from "@/assets/story/chapter-dawn.jpg";
import forest from "@/assets/story/chapter-forest.jpg";
import tunnel from "@/assets/story/chapter-tunnel.jpg";
import vault from "@/assets/story/chapter-vault.jpg";

const ART: Record<string, string> = { dawn, forest, tunnel, vault };

/** Preview shown outside Telegram so the page is never empty. */
const PREVIEW = { chapter: 1, title: "فجر على السور", image: "dawn", reward: 5000,
  story: "الشمس طلعت والضباب لسه مغطي الأرض. من فوق السور، الكشاف شاف ضلال عمالقة ماشية ناحية المدينة. القائد ساب له رسالة قبل ما يختفي.",
  riddle: "بحمي الناس من غير ما أتحرك، والعمالقة بتضربني وأنا واقف مكاني. أنا مين؟" };

export function StoryGame({ initData }: { initData: string }) {
  const [guess, setGuess] = useState("");
  const [busy, setBusy] = useState(false);
  const storyFn = useServerFn(getStory);
  const answerFn = useServerFn(answerStory);
  const spendFn = useServerFn(spendStoryItem);
  const createFn = useServerFn(createTonPayment);
  const checkFn = useServerFn(checkTonPayment);
  const q = useQuery({ queryKey: ["wall-story", initData], queryFn: () => storyFn({ data: { initData, lang: detectLang() } }), enabled: !!initData });
  const s = q.data;
  const view = s ?? PREVIEW;
  const freeLeft = s ? Math.max(0, FREE_TRIES - s.tries) : FREE_TRIES;
  const triesLeft = freeLeft + (s?.extra ?? 0);

  const needTelegram = () => { toast("افتح اللعبة من تيليجرام عشان تلعب"); };

  async function submit() {
    if (!initData) { needTelegram(); return; }
    if (!guess.trim()) return;
    setBusy(true);
    try {
      const r = await answerFn({ data: { initData, guess } });
      if (r.correct) { haptic("success"); toast.success(`${trf("إجابة صح! +{coins} {coin}", { coins: formatAmount(r.coins), coin: COIN.symbol })}${r.rank ? ` — ${trf("ترتيبك #{rank}", { rank: r.rank })}` : ""}`); setGuess(""); }
      else { haptic("error"); toast.error("إجابة غلط، فكّر تاني أو اسأل الجروب"); }
      await q.refetch();
    } catch (e) { toast.error(shopErrorMessage(e)); }
    finally { setBusy(false); }
  }

  async function spend(item: "hint" | "letter") {
    if (!initData) { needTelegram(); return; }
    setBusy(true);
    try { await spendFn({ data: { initData, item } }); haptic("success"); await q.refetch(); }
    catch (e) { toast.error(shopErrorMessage(e)); }
    finally { setBusy(false); }
  }

  async function confirm(id: string) {
    const r = await checkFn({ data: { initData, id } });
    if (r.paid) { toast.success("اتضاف العنصر!"); haptic("success"); await q.refetch(); }
  }
  async function buy(pack: string) {
    if (!initData) { needTelegram(); return; }
    setBusy(true);
    try {
      const ui = await getTonConnect();
      if (!ui.connected) { await ui.openModal(); toast("اربط محفظتك وبعدين اشتري"); return; }
      const pay = await createFn({ data: { initData, pack } });
      await ui.sendTransaction({ validUntil: Math.floor(Date.now() / 1000) + 600, messages: [{ address: pay.address, amount: pay.amount, payload: pay.payload }] });
      toast("تم إرسال الدفعة، جارٍ تأكيدها…");
      for (let i = 0; i < 12; i++) {
        await new Promise((res) => setTimeout(res, 5000));
        try { await confirm(pay.id); return; }
        catch (e) { if (!(e instanceof Error && e.message.includes("not_found_yet"))) throw e; }
      }
      toast("التأكيد لسه موصلش؛ تقدر تتحقق تاني من غير ما تدفع");
    } catch (e) { toast.error(shopErrorMessage(e)); }
    finally { setBusy(false); }
  }

  return <section className="relative z-10 mx-4 mt-4 space-y-3">
    {/* Chapter panel */}
    <article className="story-panel overflow-hidden rounded-3xl">
      <div className="relative">
        <img src={ART[view.image] ?? dawn} alt={view.title} width={768} height={1024} className="aspect-[4/5] w-full object-cover" />
        <div className="pass-shade absolute inset-0" />
        <span className="glass absolute right-3 top-3 rounded-full px-3 py-1 text-xs font-bold">الفصل {view.chapter}</span>
        <span className="glass absolute left-3 top-3 flex items-center gap-1 rounded-full px-3 py-1 text-xs"><Users className="size-3.5" />{s?.solvers ?? 0} حلّوه النهارده</span>
        <h2 className="absolute inset-x-4 bottom-3 font-display text-2xl font-extrabold">{view.title}</h2>
      </div>
      <div className="space-y-3 p-4">
        <p className="text-sm leading-7 text-foreground/85">{view.story}</p>
        <div className="story-riddle rounded-2xl p-3">
          <p className="mb-1 text-xs font-bold text-accent">لغز النهارده</p>
          <p className="font-display text-base font-extrabold leading-7">{view.riddle}</p>
          {s?.hint && <p className="mt-2 flex items-start gap-1.5 text-sm text-foreground/80"><Lightbulb className="mt-1 size-4 shrink-0 text-accent" />{s.hint}</p>}
          {s?.mask && <p dir={RTL.includes(detectLang()) ? "rtl" : "ltr"} className="mt-2 text-center font-display text-2xl font-extrabold tracking-widest text-accent">{s.mask}</p>}
        </div>

        {s?.solved ? (
          <p className="glass rounded-2xl p-3 text-center font-display font-extrabold">حليته! ترتيبك #{s.rank} — ارجع بكرة للفصل الجاي</p>
        ) : (
          <>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
              <Input value={guess} onChange={(e) => setGuess(e.target.value)} placeholder="اكتب الإجابة" maxLength={60} className="h-12 rounded-2xl text-base" />
              <Button type="submit" disabled={busy || (!!s && triesLeft <= 0)} className="btn-cta h-12 shrink-0 rounded-2xl px-5" aria-label="إرسال الإجابة"><Send className="size-5" /></Button>
            </form>
            <p className="text-center text-xs text-foreground/70">
              محاولات: <b className="text-accent">{triesLeft}</b> · الجايزة {formatAmount(view.reward)} {COIN.symbol} · أول {FIRST_SOLVERS} ياخدوا +{formatAmount(FIRST_SOLVER_BONUS)}
            </p>
            {s && (s.hints > 0 || s.letters > 0) && <div className="flex gap-2">
              {s.hints > 0 && !s.hint && <Button variant="outline" className="flex-1" disabled={busy} onClick={() => spend("hint")}><Lightbulb className="size-4" />استخدم تلميح ({s.hints})</Button>}
              {s.letters > 0 && <Button variant="outline" className="flex-1" disabled={busy} onClick={() => spend("letter")}><Type className="size-4" />اكشف حرف ({s.letters})</Button>}
            </div>}
          </>
        )}

        <a href={COMMUNITY_URL} target="_blank" rel="noreferrer" className="glass flex items-center gap-3 rounded-2xl px-4 py-3">
          <Users className="size-6 shrink-0 text-accent" />
          <span className="min-w-0 flex-1">
            <span className="block font-display font-extrabold">حلّوه مع بعض في الجروب</span>
            <span className="block text-xs text-foreground/70">ادخل الجروب واتناقش مع الكشافة في اللغز</span>
          </span>
          <span className="btn-cta shrink-0 rounded-xl px-3 py-2 text-sm font-extrabold">ادخل</span>
        </a>
      </div>
    </article>

    {/* Item shop */}
    <div>
      <h2 className="mb-2 font-display text-lg font-extrabold">متجر الكشاف</h2>
      <div className="grid grid-cols-2 gap-2">
        {STORY_ITEMS.map((it) => <button key={it.id} type="button" disabled={busy} onClick={() => buy(it.id)} className="glass flex flex-col items-center gap-1 rounded-2xl p-3 text-center disabled:opacity-60">
          {it.id === "story_hint" ? <Lightbulb className="size-7 text-accent" /> : it.id === "story_letter" ? <Type className="size-7 text-accent" /> : it.id === "story_blade" ? <Zap className="size-7 text-accent" /> : <Send className="size-7 text-accent" />}
          <span className="font-display text-sm font-extrabold">{it.label}</span>
          <span className="text-[0.65rem] leading-4 text-foreground/70">{it.desc}</span>
          <span dir="ltr" className="text-sm font-extrabold text-accent">{it.ton} TON</span>
        </button>)}
      </div>
      {s?.pendingId && <Button variant="outline" className="mt-2 w-full" disabled={busy} onClick={() => { setBusy(true); confirm(s.pendingId!).catch((e) => toast.error(shopErrorMessage(e))).finally(() => setBusy(false)); }}>تحقق من دفعة سابقة</Button>}
    </div>
  </section>;
}
