import { createFileRoute } from "@tanstack/react-router";
import { HeroesPage } from "@/components/heroes/HeroesPage";

export const Route = createFileRoute("/heroes")({
  head: () => ({
    meta: [
      { title: "الأبطال — منجم الأسوار" },
      { name: "description", content: "رقّي أبطالك لحد 1000 مستوى، عدّن أكتر، ونافس على المركز الأول." },
      { property: "og:title", content: "الأبطال — منجم الأسوار" },
      { property: "og:description", content: "5 أبطال × 200 مستوى ولوحة متصدرين." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HeroesPage,
});
