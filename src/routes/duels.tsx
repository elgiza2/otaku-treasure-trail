import { createFileRoute } from '@tanstack/react-router';
import { GrowthPanel } from '@/components/growth/GrowthPanel';
import { BottomNav } from '@/components/BottomNav';
import { useTranslationReady } from '@/i18n/DomTranslator';

export const Route = createFileRoute('/duels')({
  validateSearch: (s: Record<string,unknown>): {invite?:string} => typeof s['invite']==='string' && /^[0-9a-f-]{36}$/i.test(s['invite']) ? {invite:s['invite']} : {},
  head: () => ({meta:[{title:'تحديات الأصدقاء — منجم الأسوار'},{name:'description',content:'تحدى أصدقاءك في منجم الأسوار واسترجع نصف خسارتك بإعلان.'},{property:'og:title',content:'تحديات الأصدقاء — منجم الأسوار'},{property:'og:description',content:'تحديات بين الأصدقاء ومكافآت ANIME.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),
  component: DuelsPage,
});
function DuelsPage() { const ready=useTranslationReady();const {invite}=Route.useSearch();return <main data-translation-pending={ready?undefined:''} className="mx-auto min-h-dvh max-w-md px-4 pb-28 pt-6"><h1 className="mb-6 text-2xl font-bold">تحديات الأصدقاء</h1><GrowthPanel mode="duels" {...(invite ? {invite} : {})} /><BottomNav /></main>; }