import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import hallImage from "@/assets/tasks/garrison-hall.jpg";
import { AnimatedEmoji } from "@/components/emoji/AnimatedEmoji";
import type { EmojiName } from "@/components/emoji/emoji-registry";
import { COIN, formatAmount, referralLink } from "@/lib/coin";
import { useTelegramInitData, haptic, openExternal, shareLink } from "@/lib/telegram";
import { showRewardedAd } from "@/lib/monetag";
import { claimAdReward } from "@/lib/shop.functions";
import { shopErrorMessage } from "@/lib/shop-model";
import { claimCheckin, claimTask, getMyBoard, listTasks, saveWallet, startTask } from "@/lib/tasks.functions";
import { claimErrorMessage, isAvailable, taskState, type TaskCategory, type TaskDTO } from "@/lib/tasks-model";
import { cn } from "@/lib/utils";
import { BottomNav } from "@/components/BottomNav";
import { AdTaskCard } from "./AdTaskCard";
import { CheckinCard } from "./CheckinCard";
import { TaskCard } from "./TaskCard";
import { useNow } from "./use-now";

export const tasksQuery = queryOptions({ queryKey: ["wall-tasks"], queryFn: () => listTasks() });

export type CategoryFilter = "all" | TaskCategory;

const CATEGORIES: { id: CategoryFilter; label: string; emoji: EmojiName }[] = [
  { id: "all", label: "الكل", emoji: "sparkle" },
  { id: "onchain", label: "على السلسلة", emoji: "ton" },
  { id: "game", label: "داخل الأسوار", emoji: "blocks" },
  { id: "social", label: "اجتماعي", emoji: "globe" },
  { id: "partners", label: "الشركاء", emoji: "shields" },
];

const GUEST_MSG = "افتح اللعبة من تيليجرام عشان تستلم المكافآت";

export function TasksPage({ category }: { category: CategoryFilter }) {
  const navigate = useNavigate({ from: "/tasks" });
  const qc = useQueryClient();
  const now = useNow(1000);
  const initData = useTelegramInitData();
  const [busyTask, setBusyTask] = useState<string | null>(null);

  useEffect(() => {
    const tg = (window as unknown as { Telegram?: { WebApp?: { ready?: () => void; expand?: () => void } } }).Telegram?.WebApp;
    tg?.ready?.();
    tg?.expand?.();
  }, []);

  const { data: tasks } = useSuspenseQuery(tasksQuery);
  const fetchBoard = useServerFn(getMyBoard);
  const board = useQuery({
    queryKey: ["wall-board", initData],
    queryFn: () => fetchBoard({ data: { initData } }),
    enabled: initData.length > 0,
  });
  const player = board.data?.player ?? null;
  const progress = useMemo(
    () => new Map((board.data?.progress ?? []).map((p) => [p.taskId, p])),
    [board.data?.progress],
  );

  const refresh = () => qc.invalidateQueries({ queryKey: ["wall-board"] });
  const reward = (n: number) => {
    haptic("success");
    toast.success(`+${formatAmount(n)} ${COIN.symbol}`, { description: "اتضافت لرصيدك" });
  };
  const fail = (e: unknown) => {
    haptic("error");
    toast.error(claimErrorMessage(e));
  };

  const checkinFn = useServerFn(claimCheckin);
  const checkin = useMutation({
    mutationFn: () => checkinFn({ data: { initData } }),
    onSuccess: (r) => {
      reward(Number(r.reward));
      void refresh();
    },
    onError: fail,
  });

  const startFn = useServerFn(startTask);
  const claimFn = useServerFn(claimTask);
  const start = useMutation({
    mutationFn: (taskId: string) => startFn({ data: { initData, taskId } }),
    onSuccess: () => void refresh(),
    onError: fail,
    onSettled: () => setBusyTask(null),
  });
  const claim = useMutation({
    mutationFn: (taskId: string) => claimFn({ data: { initData, taskId } }),
    onSuccess: (r) => {
      reward(r.reward);
      void refresh();
    },
    onError: fail,
    onSettled: () => setBusyTask(null),
  });

  // Ads task: open-ended, one reward per finished ad.
  const adFn = useServerFn(claimAdReward);
  const [adsWatched, setAdsWatched] = useState(0);
  const ad = useMutation({
    mutationFn: async () => { await showRewardedAd(); return adFn({ data: { initData } }); },
    onSuccess: (r) => { reward(r.amount); setAdsWatched((n) => n + 1); void refresh(); },
    onError: (e) => {
      haptic("error");
      toast.error(e instanceof Error && e.message === "ad_unavailable" ? "مفيش إعلان متاح دلوقتي، جرب كمان شوية" : shopErrorMessage(e));
    },
  });

  // Save the TON wallet once the player connects it, so the wallet task unlocks.
  const saveWalletFn = useServerFn(saveWallet);
  useEffect(() => {
    if (!initData || !player) return;
    let unsub: (() => void) | undefined;
    let alive = true;
    void import("@/lib/ton-connect").then(async ({ getTonConnect }) => {
      const { toUserFriendlyAddress } = await import("@tonconnect/ui");
      const ui = await getTonConnect();
      if (!alive) return;
      const sync = async (raw?: string) => {
        if (!raw) return;
        const address = toUserFriendlyAddress(raw);
        if (address === player.wallet) return;
        await saveWalletFn({ data: { initData, address } }).catch(fail);
        void refresh();
      };
      void sync(ui.account?.address);
      unsub = ui.onStatusChange((w) => void sync(w?.account.address));
    });
    return () => {
      alive = false;
      unsub?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initData, player?.wallet, player?.tgId]);

  const rows = useMemo(() => {
    const t = now || Date.now();
    return tasks
      .map((task) => ({ task, state: taskState(task, progress.get(task.id), player, t) }))
      .sort((a, b) => Number(!isAvailable(a.state)) - Number(!isAvailable(b.state)) || a.task.sort - b.task.sort);
  }, [tasks, progress, player, now]);

  const available = rows.filter((r) => isAvailable(r.state));
  const shown = category === "all" ? rows : rows.filter((r) => r.task.category === category);

  const act = async (task: TaskDTO) => {
    if (!initData) return toast(GUEST_MSG);
    const state = taskState(task, progress.get(task.id), player, Date.now());
    if (state.type === "verify" || state.type === "ready") {
      setBusyTask(task.id);
      return claim.mutate(task.id);
    }
    if (state.type === "progress" || task.kind === "share") {
      if (!player) return;
      shareLink(referralLink(player.tgId), "انضم ليا خلف الأسوار وابدأ تعدين الذهب 🪙");
      if (task.kind === "share") {
        setBusyTask(task.id);
        start.mutate(task.id);
      }
      return;
    }
    if (task.kind === "wallet") {
      const { getTonConnect } = await import("@/lib/ton-connect");
      const ui = await getTonConnect();
      return ui.openModal();
    }
    if (task.url) openExternal(task.url);
    setBusyTask(task.id);
    start.mutate(task.id);
  };

  return (
    <main className="relative mx-auto min-h-dvh w-full max-w-md overflow-x-hidden bg-background pb-28">
      {/* Garrison hall backdrop with a flickering lantern */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[27rem] overflow-hidden">
        <img src={hallImage} alt="" width={720} height={1271} className="h-full w-full object-cover object-top" />
        <div className="lantern-glow animate-lantern absolute left-[2%] top-[2%] size-40 rounded-full" />
        <div className="lantern-glow animate-lantern absolute left-[46%] top-[17%] size-24 rounded-full [animation-delay:1.1s]" />
        <div className="hero-fade absolute inset-0" />
      </div>

      <div className="relative px-4 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <header className="animate-rise flex flex-col items-center pt-16 text-center">
          <h1 className="animate-slam mt-1 font-display text-5xl font-extrabold text-gold drop-shadow-lg">المهام</h1>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {player ? (
              <span className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-foreground">
                رصيدك
                <span dir="ltr" className="text-gold font-display font-extrabold">
                  {formatAmount(player.balance)}
                </span>
              </span>
            ) : null}
          </div>
        </header>

        <div className="mt-6">
          <CheckinCard
            player={player}
            now={now}
            claiming={checkin.isPending}
            onClaim={() => (initData ? checkin.mutate() : toast(GUEST_MSG))}
          />
        </div>

        <div className="mt-3">
          <AdTaskCard busy={ad.isPending} watched={adsWatched} onWatch={() => (initData ? ad.mutate() : toast(GUEST_MSG))} />
        </div>

        <nav aria-label="أقسام المهام" className="-mx-4 mt-5 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max gap-2">
            {CATEGORIES.map((c) => {
              const active = c.id === category;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => navigate({ search: c.id === "all" ? {} : { c: c.id }, replace: true })}
                  className={cn(
                    "flex h-11 items-center gap-2 rounded-full border pe-4 ps-2 text-sm font-semibold transition-colors",
                    active
                      ? "border-transparent btn-cta"
                      : "glass text-muted-foreground",
                  )}
                >
                  <span className="grid size-7 place-items-center">
                    <AnimatedEmoji name={c.emoji} className={cn("size-5", active ? "text-primary-foreground" : "text-accent")} />
                  </span>
                  {c.label}
                </button>
              );
            })}
          </div>
        </nav>

        <section className="mt-4 flex flex-col gap-3">
          {shown.map((r, i) => (
            <TaskCard
              key={r.task.id}
              task={r.task}
              state={r.state}
              now={now}
              index={i}
              busy={busyTask === r.task.id}
              onAction={() => void act(r.task)}
            />
          ))}
          {shown.length === 0 && (
            <p className="glass-card rounded-[1.5rem] p-6 text-center text-sm text-muted-foreground">
              مفيش مهام هنا دلوقتي، ارجع قريب.
            </p>
          )}
        </section>
      </div>
      <BottomNav />
    </main>
  );
}
