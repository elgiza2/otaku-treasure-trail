import { createFileRoute } from "@tanstack/react-router";
import { PartnerPage } from "@/components/partners/PartnerPage";
export const Route = createFileRoute("/partners")({
  head: () => ({ meta: [
    { title: "قنوات الشركاء — منجم الأسوار" },
    { name: "description", content: "قنوات الشركاء وأرباح الإحالات بعملة GRAM وطلبات السحب كل 30 يوماً." },
    { property: "og:title", content: "قنوات الشركاء — منجم الأسوار" },
    { property: "og:description", content: "تابع قنواتك والمستخدمين الجدد وأرباح GRAM." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: PartnerPage,
});