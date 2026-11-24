import { createFileRoute } from "@tanstack/react-router";

// Public manifest that TON wallets fetch before connecting. Built from the request
// origin so it matches whichever public domain (dev, published, custom) serves it.
export const Route = createFileRoute("/api/public/tonconnect-manifest")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        return Response.json(
          {
            url: origin,
            name: "منجم الأسوار",
            iconUrl: `${origin}/api/public/wallet-icon`,
          },
          {
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "public, max-age=300",
            },
          },
        );
      },
    },
  },
});
