import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { SquadsPage, squadsQuery } from "@/components/squads/SquadsPage";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/squads")({
  validateSearch: (search) => ({ invite: z.string().uuid().optional().catch(undefined).parse(search["invite"]) }),
  loader: ({ context }) => context.queryClient.ensureQueryData(squadsQuery),
  head: () => ({ meta: [
    { title: "دوري التحالفات — منجم الأسوار" },
    { name: "description", content: "تنافس مع تحالفك كل أسبوع على 10 GRAM من الإعلانات والإحالات الموثقة." },
    { property: "og:title", content: "دوري التحالفات — منجم الأسوار" },
    { property: "og:description", content: "تحالفات وأصدقاء وجوائز أسبوعية بقيمة 10 GRAM." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <SquadsPage invite={Route.useSearch().invite} />,
  errorComponent: ({ reset }) => <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-4"><p>تعذّر تحميل التحالفات</p><Button onClick={reset}>حاول تاني</Button></main>,
});