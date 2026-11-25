import { createFileRoute } from '@tanstack/react-router';
import { GrowthPanel } from '@/components/growth/GrowthPanel';
import { BottomNav } from '@/components/BottomNav';
import { useTranslationReady } from '@/i18n/DomTranslator';
import vaultImage from '@/assets/onboarding/v3-2-mine.jpg';

export const Route = createFileRoute('/store')({
  head: () => ({meta:[{title:'متجر الحزم السريعة — منجم الأسوار'},{name:'description',content:'حزم الطاقة واللفات والحماية ومضاعفة غنائم التعدين بالدفع عبر TON.'},{property:'og:title',content:'متجر منجم الأسوار'},{property:'og:description',content:'حزم صغيرة للطاقة واللفات وتعزيزات المعارك.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),
  component: StorePage,
});
function StorePage() {
  const ready=useTranslationReady();
  return <main data-translation-pending={ready?undefined:''} className="relative mx-auto min-h-dvh max-w-md overflow-x-hidden bg-background pb-28">
    <div className="pointer-events-none absolute inset-x-0 top-0 h-72 overflow-hidden" aria-hidden="true">
      <img src={vaultImage} alt="" className="size-full object-cover object-[center_20%]" />
      <div className="wallet-shade absolute inset-0" />
    </div>
    <div className="relative px-4 pt-6">
      <header className="mb-5 text-center">
        <h1 className="font-display text-3xl font-extrabold text-gold drop-shadow-sm">المتجر</h1>
        <p className="mt-1 text-xs font-semibold text-muted-foreground">حزم سريعة · TON</p>
      </header>
      <GrowthPanel mode="shop" />
    </div>
    <BottomNav />
  </main>;
}