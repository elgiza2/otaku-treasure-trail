import { createFileRoute } from "@tanstack/react-router";
import { BattlePage } from "@/components/battle/BattlePage";

export const Route = createFileRoute("/battle")({
  head: () => ({
    meta: [
      { title: "ساحة الحرب — منجم الأسوار" },
      { name: "description", content: "أبطالك بيقتلوا العمالقة طول الوقت، وكل عملاق بيقع بيديك عملات." },
      { property: "og:title", content: "ساحة الحرب — منجم الأسوار" },
      { property: "og:description", content: "كل عملاق يقع = عملات في مخزنك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BattlePage,
});
