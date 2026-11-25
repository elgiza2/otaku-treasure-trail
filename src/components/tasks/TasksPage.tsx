import { useMemo, useState } from 'react';
import { queryOptions, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { BottomNav } from '@/components/BottomNav';
import { GrowthPanel } from '@/components/growth/GrowthPanel';
import { AdTaskCard } from './AdTaskCard';
import { TaskCard } from './TaskCard';
import { useNow } from './use-now';
import { getMyBoard, listTasks, claimTask, startTask } from '@/lib/tasks.functions';
import { claimAdReward } from '@/lib/shop.functions';
import { claimErrorMessage, taskState, type TaskCategory, type TaskDTO } from '@/lib/tasks-model';
import { useTelegramInitData, shareLink, openExternal } from '@/lib/telegram';
import { referralLink } from '@/lib/coin';
import { showAdsgramAd } from '@/lib/adsgram';
import { showRewardedAd } from '@/lib/monetag';
import type { AdProvider } from '@/lib/tournament-model';
import { useTranslationReady } from '@/i18n/DomTranslator';

export const tasksQuery = queryOptions({ queryKey: ['wall-tasks'], queryFn: () => listTasks() });
export type CategoryFilter = 'all' | TaskCategory;
export function TasksPage({ category }: { category: CategoryFilter }) {
  const translationReady=useTranslationReady();
  const initData=useTelegramInitData(); const now=useNow(1000); const qc=useQueryClient();
  const [tab,setTab]=useState<'daily'|'ads'|'friends'>(category==='game'?'friends':'daily');
  const [busyTask,setBusyTask]=useState<string|null>(null);
  const [busyAd,setBusyAd]=useState<AdProvider|null>(null); const [watched,setWatched]=useState(0);
  const {data:tasks}=useSuspenseQuery(tasksQuery);
  const load=useServerFn(getMyBoard); const start=useServerFn(startTask); const claim=useServerFn(claimTask); const ad=useServerFn(claimAdReward);
  const board=useQuery({queryKey:['wall-board',initData],queryFn:()=>load({data:{initData}}),enabled:!!initData});
  const player=board.data?.player??null;
  const progress=useMemo(()=>new Map((board.data?.progress??[]).map(p=>[p.taskId,p])),[board.data?.progress]);
  const rows=tasks.filter(t=>category==='all'||t.category===category);
  async function act(task:TaskDTO) {
    if(!initData){toast('افتح اللعبة من تيليجرام عشان تستلم المكافآت');return;}
    const state=taskState(task,progress.get(task.id),player,now);
    setBusyTask(task.id);
    try {
      if(state.type==='ready'||state.type==='verify'){const r=await claim({data:{initData,taskId:task.id}});toast.success(`+${r.reward} ANIME`);}
      else if(task.kind==='referral'||task.kind==='share'){if(player)shareLink(referralLink(player.tgId),'العب معايا في منجم الأسوار!');if(task.kind==='share')await start({data:{initData,taskId:task.id}});}
      else if(task.kind==='wallet'){await(await import('@/lib/ton-connect')).getTonConnect().then(ui=>ui.openModal());}
      else {if(task.url)openExternal(task.url);await start({data:{initData,taskId:task.id}});}
      await qc.invalidateQueries({queryKey:['wall-board']});
    }catch(e){toast.error(claimErrorMessage(e));}finally{setBusyTask(null);}
  }
  async function watch(provider:AdProvider){
    if(!initData){toast('افتح اللعبة من تيليجرام عشان تستلم المكافآت');return;}
    if(busyAd)return;setBusyAd(provider);
    try{if(provider==='adsgram')await showAdsgramAd();else await showRewardedAd();const r=await ad({data:{initData,provider}});setWatched(n=>n+1);toast.success(`+${r.amount} ANIME · +10 نقاط`);await qc.invalidateQueries();}
    catch(e){toast.error(e instanceof Error&&e.message.includes('ad_skipped')?'الإعلان ما اكتملش':'مفيش إعلان متاح، جرّب الشبكة التانية');}
    finally{setBusyAd(null);}
  }
  return <main data-translation-pending={translationReady?undefined:''} className="mx-auto min-h-dvh max-w-md px-4 pb-28 pt-6">
    <h1 className="mb-5 text-2xl font-bold">المهام والمكافآت</h1>
    <div role="tablist" aria-label="أقسام المكافآت" className="mb-6 grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">{([{id:'daily',label:'اليومية'},{id:'ads',label:'الإعلانات'},{id:'friends',label:'الأصدقاء'}] as const).map(t=><Button key={t.id} role="tab" aria-selected={tab===t.id} variant={tab===t.id?'default':'ghost'} onClick={()=>setTab(t.id)}>{t.label}</Button>)}</div>
    <div role="tabpanel">
      {tab==='daily'&&<><GrowthPanel mode="daily"/><details className="mt-8 border-t border-border pt-4"><summary className="cursor-pointer text-sm font-bold">مهام الحامية · {rows.length}</summary><div className="mt-4 space-y-3">{rows.map((task,i)=><TaskCard key={task.id} task={task} state={taskState(task,progress.get(task.id),player,now)} now={now} index={i} busy={busyTask===task.id} onAction={()=>void act(task)}/>)}</div></details></>}
      {tab==='ads'&&<><AdTaskCard busyProvider={busyAd} watched={watched} onWatch={p=>void watch(p)}/><p className="mt-4 text-center text-xs text-muted-foreground">بلا حدود · 15 ANIME + 10 نقاط لكل إعلان</p></>}
      {tab==='friends'&&<GrowthPanel mode="referrals"/>}
    </div><BottomNav/>
  </main>;
}
