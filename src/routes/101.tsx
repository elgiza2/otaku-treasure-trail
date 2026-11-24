import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/components/admin/AdminPage";

export const Route = createFileRoute("/101")({
  head: () => ({ meta: [
    { title: "لوحة الإدارة — ANIME" },
    { name: "description", content: "لوحة إدارة خاصة بالمشرفين." },
    { name: "robots", content: "noindex" },
    { property: "og:title", content: "لوحة الإدارة — ANIME" },
    { property: "og:description", content: "لوحة إدارة خاصة بالمشرفين." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AdminPage,
});
