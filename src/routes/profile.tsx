import { createFileRoute } from "@tanstack/react-router";
import { ProfilePage } from "@/components/profile/ProfilePage";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [
    { title: "الملف الشخصي — منجم الأسوار" },
    { name: "description", content: "ملفك في الحامية: تقدم أبطالك، فريق الإحالات وترتيبك بين اللاعبين." },
    { property: "og:title", content: "الملف الشخصي — منجم الأسوار" },
    { property: "og:description", content: "ابنِ فريقك خلف الأسوار وتابع مستواك وترتيبك." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: ProfilePage,
});