import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { lastPageAsync } from "@/lib/last-page";
import { getInitData } from "@/lib/telegram";
import { squadStartParam } from "@/lib/game-model";

import { StoryOnboarding } from "@/components/onboarding/StoryOnboarding";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "منجم الأسوار — ابدأ القصة" },
      { name: "description", content: "قصة البداية: خلف الأسوار يبدأ التعدين. لعبة تعدين أنمي داخل تيليجرام." },
      { property: "og:title", content: "منجم الأسوار — ابدأ القصة" },
      { property: "og:description", content: "خلف الأسوار يبدأ التعدين. لعبة تعدين أنمي داخل تيليجرام." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    const squad = squadStartParam(getInitData());
    if (squad) { void navigate({ to: "/squads", search: { invite: squad }, replace: true }); return; }
    let live = true;
    lastPageAsync().then((p) => {
      if (!live) return;
      if (p) navigate({ to: p as "/tasks", replace: true });
      else setChecked(true);
    });
    return () => { live = false; };
  }, [navigate]);
  if (!checked) return <main className="h-dvh bg-background" />;
  return <StoryOnboarding />;
}
