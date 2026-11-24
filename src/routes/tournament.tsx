import { createFileRoute, useRouter, type ErrorComponentProps } from "@tanstack/react-router";

import { TournamentPage, tournamentQuery } from "@/components/tournament/TournamentPage";

export const Route = createFileRoute("/tournament")({
  loader: ({ context }) => context.queryClient.ensureQueryData(tournamentQuery),
  head: () => ({
    meta: [
      { title: "مسابقة GRAM — منجم الأسوار" },
      { name: "description", content: "تنافس كل 3 أيام على 350 GRAM بمشاهدة الإعلانات ودعوة الأصدقاء الموثقين." },
      { property: "og:title", content: "مسابقة GRAM — منجم الأسوار" },
      { property: "og:description", content: "دورة تنافسية كل 3 أيام بجوائز 350 GRAM لأفضل 20 لاعباً." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TournamentPage,
  errorComponent: TournamentError,
  notFoundComponent: () => <div className="p-8 text-center text-muted-foreground">الصفحة غير موجودة</div>,
});

function TournamentError({ error }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <div role="alert" className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-foreground">تعذّر تحميل المسابقة</p>
      <p className="text-xs text-muted-foreground">{error instanceof Error ? error.message : String(error)}</p>
      <button type="button" onClick={() => router.invalidate()} className="btn-cta rounded-full px-6 py-2 font-semibold">
        حاول تاني
      </button>
    </div>
  );
}