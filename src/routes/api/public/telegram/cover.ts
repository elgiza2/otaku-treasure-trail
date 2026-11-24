import { createFileRoute } from "@tanstack/react-router";
import cover from "@/assets/brand/bot-start-cover.jpg?inline";

// Public copy of the /start photo: Telegram's servers fetch it without a login.
export const Route = createFileRoute("/api/public/telegram/cover")({
  server: {
    handlers: {
      GET: async () => {
        const b64 = cover.slice(cover.indexOf(",") + 1);
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        return new Response(bytes, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400" } });
      },
    },
  },
});
