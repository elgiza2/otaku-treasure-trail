import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const querySchema = z.object({
  userid: z.string().regex(/^\d{1,20}$/),
});

/**
 * Adsgram Server-to-Server Reward URL callback.
 * Configured in Adsgram dashboard as:
 *   https://<domain>/api/public/adsgram/reward?userid=[userId]
 */
export const Route = createFileRoute("/api/public/adsgram/reward")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const parsed = querySchema.safeParse({ userid: url.searchParams.get("userid") ?? "" });
        if (!parsed.success) {
          return Response.json({ ok: false, error: "invalid_userid" }, { status: 400 });
        }
        const tgId = Number(parsed.data.userid);
        if (!Number.isSafeInteger(tgId) || tgId <= 0) {
          return Response.json({ ok: false, error: "invalid_userid" }, { status: 400 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: amt, error } = await supabaseAdmin.rpc("wall_ad_reward_v2" as never, {
          _tg: tgId,
          _provider: "adsgram",
        } as never);
        if (error) {
          const status = error.message.includes("no_user") ? 404 : 500;
          return Response.json({ ok: false, error: error.message }, { status });
        }
        return Response.json({ ok: true, reward: Number(amt) });
      },
    },
  },
});