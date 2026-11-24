import { createFileRoute } from "@tanstack/react-router";
import { RaidPage } from "@/components/raid/RaidPage";

export const Route = createFileRoute("/raid")({
  head: () => ({
    meta: [
      { title: "حكايات السور — منجم الأسوار" },
      { name: "description", content: "قصة مصورة كل يوم فيها لغز، حله مع الجروب واكسب عملات، ولف عجلة الغارات." },
      { property: "og:title", content: "حكايات السور — منجم الأسوار" },
      { property: "og:description", content: "غارات وانتقام وخزينة بتكبر مع كل لفة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RaidPage,
});
