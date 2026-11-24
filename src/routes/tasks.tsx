import { createFileRoute, useRouter, type ErrorComponentProps } from "@tanstack/react-router";

import { TasksPage, tasksQuery, type CategoryFilter } from "@/components/tasks/TasksPage";

const FILTERS: CategoryFilter[] = ["all", "onchain", "game", "social", "partners"];

export const Route = createFileRoute("/tasks")({
  validateSearch: (search: Record<string, unknown>): { c?: Exclude<CategoryFilter, "all"> } => {
    const c = search["c"];
    return typeof c === "string" && FILTERS.includes(c as CategoryFilter) && c !== "all"
      ? { c: c as Exclude<CategoryFilter, "all"> }
      : {};
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(tasksQuery),
  head: () => ({
    meta: [
      { title: "المهام — منجم الأسوار" },
      { name: "description", content: "أنجز مهام الحامية، سجّل حضورك اليومي، واجمع عملات الأسوار." },
      { property: "og:title", content: "المهام — منجم الأسوار" },
      { property: "og:description", content: "مهام يومية ومكافآت حضور داخل لعبة تعدين أنمي على تيليجرام." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TasksRoute,
  errorComponent: TasksError,
  notFoundComponent: () => <div className="p-8 text-center text-muted-foreground">الصفحة غير موجودة</div>,
});

function TasksRoute() {
  const { c } = Route.useSearch();
  return <TasksPage category={c ?? "all"} />;
}

function TasksError({ error }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <div role="alert" className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-foreground">تعذّر تحميل المهام</p>
      <p className="text-xs text-muted-foreground">{error instanceof Error ? error.message : String(error)}</p>
      <button type="button" onClick={() => router.invalidate()} className="btn-cta rounded-full px-6 py-2 font-semibold">
        حاول تاني
      </button>
    </div>
  );
}
