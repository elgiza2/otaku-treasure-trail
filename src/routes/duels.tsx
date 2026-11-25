import { createFileRoute } from '@tanstack/react-router';
import { GrowthPanel } from '@/components/growth/GrowthPanel';
import { BottomNav } from '@/components/BottomNav';
import { useTranslationReady } from '@/i18n/DomTranslator';
import hallImage from '@/assets/tasks/garrison-hall.jpg';

export const Route = createFileRoute('/duels')({
  validateSearch: (s: Record<string,unknown>): {invite?:string} => typeof s['invite']==='string' && /^[0-9a-f-]{36}$/i.test(s['invite']) ? {invite:s['invite']} : {},
  head: () => ({meta:[{title:'تحديات الأصدقاء — منجم الأسوار'},{name:'description',content:'تحدى أصدقاءك في منجم الأسوار واسترجع نصف خسارتك بإعلان.'},{property:'og:title',content:'تحديات الأصدقاء — منجم الأسوار'},{property:'og:description',content:'تحديات بين الأصدقاء ومكافآت ANIME.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),
  component: DuelsPage,
});
function DuelsPage() {
  const ready=useTranslationReady();
  const {invite}=Route.useSearch();
  return <main data-translation-pending={ready?undefined:''} className="relative mx-auto min-h-dvh max-w-md overflow-x-hidden bg-background pb-28">
    <div className="pointer-events-none absolute inset-x-0 top-0 h-72 overflow-hidden" aria-hidden="true">
      <img src={hallImage} alt="" className="size-full object-cover object-top" />
      <div className="hero-fade absolute inset-0" />
    </div>
    <div className="relative px-4 pt-6">
      <header className="mb-5 text-center">
        <h1 className="font-display text-3xl font-extrabold text-gold drop-shadow-sm">تحديات الأصدقاء</h1>
      </header>
      <GrowthPanel mode="duels" {...(invite ? {invite} : {})} />
    </div>
    <BottomNav />
  </main>;
}