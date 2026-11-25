import { createFileRoute } from '@tanstack/react-router';
import { GrowthPanel } from '@/components/growth/GrowthPanel';
import { BottomNav } from '@/components/BottomNav';
import { useTranslationReady } from '@/i18n/DomTranslator';

export const Route = createFileRoute('/store')({
  head: () => ({meta:[{title:'متجر الحزم السريعة — منجم الأسوار'},{name:'description',content:'حزم الطاقة واللفات والحماية ومضاعفة غنائم التعدين بالدفع عبر TON.'},{property:'og:title',content:'متجر منجم الأسوار'},{property:'og:description',content:'حزم صغيرة للطاقة واللفات وتعزيزات المعارك.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),
  component: StorePage,
});
function StorePage() { const ready=useTranslationReady();return <main data-translation-pending={ready?undefined:''} className="mx-auto min-h-dvh max-w-md px-4 pb-28 pt-6"><h1 className="mb-2 text-2xl font-bold">المتجر</h1><p className="mb-6 text-sm text-muted-foreground">حزم سريعة · TON</p><GrowthPanel mode="shop" /><BottomNav /></main>; }