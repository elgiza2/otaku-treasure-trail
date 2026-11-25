import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getInitData, useTelegramInitData } from "@/lib/telegram";
import { PartnerAdminPanel } from "./PartnerAdminPanel";
import {
  adminDeleteTask, adminListTasks, adminMe, adminSaveTask, adminSetHelper, adminStats, type AdminRole,
} from "@/lib/admin.functions";

type Task = Awaited<ReturnType<typeof adminListTasks>>[number];
type Stats = Awaited<ReturnType<typeof adminStats>>;
const EMPTY = { title: "", url: "", chat_id: "", category: "partners", kind: "link", reward: 5, emoji: "sparkle", sort: 0, active: true };

export function AdminPage() {
  const initData = useTelegramInitData();
  const [role, setRole] = useState<AdminRole | null | undefined>(undefined);
  const me = useServerFn(adminMe);
  useEffect(() => {
    if (!initData) { setRole(null); return; }
    let live = true;
    setRole(undefined);
    me({ data: { initData } }).then((r) => { if (live) setRole(r.role); }).catch(() => { if (live) setRole(null); });
    return () => { live = false; };
  }, [me, initData]);

  if (role === undefined) return <Shell><p className="text-muted-foreground">جاري التحقق…</p></Shell>;
  if (!role) return <Shell><p className="text-muted-foreground">الصفحة دي للمشرفين بس. افتحها من التطبيق في تيليجرام.</p></Shell>;
  return (
    <Shell>
      {role === "owner" && <StatsPanel />}
      {role === "owner" && <PartnerAdminPanel />}
      <TasksPanel />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-md space-y-4 px-4 pb-32 [--main-pt:1.5rem]">
      <h1 className="text-2xl font-bold">لوحة الإدارة</h1>
      {children}
    </main>
  );
}

function StatsPanel() {
  const statsFn = useServerFn(adminStats);
  const helperFn = useServerFn(adminSetHelper);
  const [s, setS] = useState<Stats | null>(null);
  const [name, setName] = useState("");
  const load = () => statsFn({ data: { initData: getInitData() } }).then(setS).catch((e) => toast.error(String(e.message)));
  useEffect(() => { load(); }, []);
  const helper = async (username: string, remove: boolean) => {
    try { await helperFn({ data: { initData: getInitData(), username, remove } }); setName(""); toast.success(remove ? "اتشال" : "اتضاف"); load(); }
    catch (e) { toast.error((e as Error).message); }
  };
  if (!s) return <div className="glass rounded-2xl p-4 text-muted-foreground">جاري تحميل الإحصائيات…</div>;
  const cells: [string, string][] = [
    ["اللاعبين", s.users.toLocaleString()], ["نشطين آخر 24 ساعة", s.active.toLocaleString()],
    ["جداد النهارده", s.newUsers.toLocaleString()], ["كروت NFT", s.nfts.toLocaleString()],
    ["عمليات دفع", s.paidCount.toLocaleString()], ["TON إجمالي", s.tonTotal.toFixed(2)],
    ["TON آخر 24 ساعة", s.tonToday.toFixed(2)], ["سحب مستني", s.pendingWithdrawals.toLocaleString()],
  ];
  return (
    <>
      <section className="grid grid-cols-2 gap-2">
        {cells.map(([k, v]) => (
          <div key={k} className="glass rounded-2xl p-3"><div className="text-xs text-muted-foreground">{k}</div><div className="text-xl font-bold">{v}</div></div>
        ))}
      </section>
      <section className="glass space-y-2 rounded-2xl p-4">
        <h2 className="font-bold">آخر المدفوعات</h2>
        {s.recent.length === 0 && <p className="text-sm text-muted-foreground">لسه مفيش.</p>}
        {s.recent.map((p, i) => (
          <div key={i} className="flex justify-between text-sm"><span>{p.pack}</span><span>{p.ton.toFixed(2)} TON</span></div>
        ))}
      </section>
      <section className="glass space-y-2 rounded-2xl p-4">
        <h2 className="font-bold">المشرفين</h2>
        {s.admins.map((a) => (
          <div key={a.username} className="flex items-center justify-between text-sm">
            <span dir="ltr">@{a.username}</span>
            {a.role === "owner" ? <span className="text-muted-foreground">أدمن كامل</span>
              : <button className="text-destructive" onClick={() => helper(a.username, true)}>شيل</button>}
          </div>
        ))}
        <div className="flex gap-2 pt-1">
          <input dir="ltr" value={name} onChange={(e) => setName(e.target.value)} placeholder="@username"
            className="min-w-0 flex-1 rounded-xl border border-border bg-background/40 px-3 py-2 text-sm" />
          <button className="btn-cta rounded-xl px-3 text-sm" onClick={() => helper(name, false)}>أضف مشرف مهام</button>
        </div>
        <p className="text-xs text-muted-foreground">مشرف المهام يقدر يضيف ويعدل ويمسح المهام بس.</p>
      </section>
    </>
  );
}

function TasksPanel() {
  const listFn = useServerFn(adminListTasks);
  const saveFn = useServerFn(adminSaveTask);
  const delFn = useServerFn(adminDeleteTask);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [edit, setEdit] = useState<{ id: string | null; t: typeof EMPTY } | null>(null);
  const load = () => listFn({ data: { initData: getInitData() } }).then(setTasks).catch((e) => toast.error(String(e.message)));
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!edit) return;
    const t = edit.t;
    try {
      await saveFn({ data: { initData: getInitData(), id: edit.id, task: {
        ...t, url: t.url.trim() || null, chat_id: t.chat_id.trim() || null, reward: Number(t.reward), sort: Number(t.sort),
      } } });
      toast.success("اتحفظت"); setEdit(null); load();
    } catch (e) { toast.error((e as Error).message); }
  };
  const remove = async (id: string) => {
    if (!confirm("تمسح المهمة دي؟")) return;
    try { await delFn({ data: { initData: getInitData(), id } }); toast.success("اتمسحت"); load(); }
    catch (e) { toast.error((e as Error).message); }
  };
  const f = (k: keyof typeof EMPTY, label: string, type = "text") => (
    <label className="block space-y-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input type={type} dir={type === "text" && k !== "title" ? "ltr" : undefined} value={String(edit!.t[k])}
        onChange={(e) => setEdit({ ...edit!, t: { ...edit!.t, [k]: e.target.value } })}
        className="w-full rounded-xl border border-border bg-background/40 px-3 py-2" />
    </label>
  );

  return (
    <section className="glass space-y-3 rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">المهام ({tasks.length})</h2>
        <button className="btn-cta rounded-xl px-3 py-1.5 text-sm" onClick={() => setEdit({ id: null, t: { ...EMPTY } })}>+ مهمة</button>
      </div>
      {edit && (
        <div className="space-y-2 rounded-xl border border-border p-3">
          {f("title", "العنوان")}{f("url", "الرابط")}{f("chat_id", "آيدي القناة (للتحقق من الاشتراك)")}
          {f("category", "القسم")}{f("kind", "النوع")}{f("reward", "المكافأة", "number")}{f("emoji", "الأيقونة")}{f("sort", "الترتيب", "number")}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={edit.t.active} onChange={(e) => setEdit({ ...edit, t: { ...edit.t, active: e.target.checked } })} /> ظاهرة للاعبين
          </label>
          <div className="flex gap-2">
            <button className="btn-cta flex-1 rounded-xl py-2" onClick={save}>حفظ</button>
            <button className="flex-1 rounded-xl border border-border py-2" onClick={() => setEdit(null)}>إلغاء</button>
          </div>
        </div>
      )}
      {tasks.map((t) => (
        <div key={t.id} className="flex items-center justify-between gap-2 border-t border-border/50 pt-2 text-sm">
          <div className="min-w-0">
            <div className="truncate font-medium">{t.title}{!t.active && <span className="text-muted-foreground"> (مخفية)</span>}</div>
            <div className="text-xs text-muted-foreground">{t.category} · {t.reward}</div>
          </div>
          <div className="flex shrink-0 gap-3">
            <button className="text-accent" onClick={() => setEdit({ id: t.id, t: {
              title: t.title, url: t.url ?? "", chat_id: t.chat_id ?? "", category: t.category, kind: t.kind,
              reward: t.reward, emoji: t.emoji, sort: t.sort, active: t.active } })}>تعديل</button>
            <button className="text-destructive" onClick={() => remove(t.id)}>مسح</button>
          </div>
        </div>
      ))}
    </section>
  );
}
