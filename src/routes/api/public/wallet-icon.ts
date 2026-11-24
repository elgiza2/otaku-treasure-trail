import { createFileRoute } from "@tanstack/react-router";

import iconDataUrl from "@/assets/brand/wallet-icon.png?inline";

// App icon shown inside the wallet. Served from /api/public so wallets can load it
// on hosts where ordinary static files sit behind a login.
export const Route = createFileRoute("/api/public/wallet-icon")({
  server: {
    handlers: {
      GET: async () => {
        const base64 = iconDataUrl.slice(iconDataUrl.indexOf(",") + 1);
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        return new Response(bytes, {
          headers: {
            "Content-Type": "image/png",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=86400",
          },
        });
      },
    },
  },
});
