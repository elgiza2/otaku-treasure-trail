import { createFileRoute } from "@tanstack/react-router";
import { POSTS } from "@/content/channel-posts";
import { BATCH, cronSecret, currentSlot, DAILY_GIFT_COINS, slotMessage } from "@/lib/bot-daily.server";

// Post pictures ship with the app; the scheduler fetches the bytes from its own origin and uploads them to Telegram.
const POST_IMAGES = import.meta.glob("/src/assets/posts/*.jpg", { eager: true, query: "?url", import: "default" }) as Record<string, string>;

const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!);

// Called by an external scheduler every ~10 minutes with ?key=<secret>.
// Sends at most BATCH messages per run; players get each slot once.
export const Route = createFileRoute("/api/public/telegram/daily")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = process.env["TELEGRAM_BOT_TOKEN"];
        if (!token) return new Response("not configured", { status: 500 });
        if (new URL(request.url).searchParams.get("key") !== (await cronSecret(token))) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
        const { data: locked } = await db.rpc("wall_job_lock" as never, { _name: "daily", _seconds: 50 } as never);
        if (!locked) return Response.json({ ok: true, skipped: "running" });

        const posted = await autoPost(db, token, new URL(request.url).origin);
        const slot = currentSlot();
        let giftId: string | null = null;
        if (slot.hour === 8) {
          const { data, error } = await db.rpc("wall_today_gift" as never, { _amount: DAILY_GIFT_COINS } as never);
          if (error) return Response.json({ error: error.message }, { status: 500 });
          giftId = data as unknown as string;
        }
        const { data: users, error } = await db.from("wall_users")
          .select("tg_id, first_name, language_code")
          .eq("bot_blocked" as never, false as never)
          .or(`notified_slot.is.null,notified_slot.neq.${slot.key}`)
          .limit(BATCH);
        if (error) return Response.json({ error: error.message }, { status: 500 });

        let sent = 0, blocked = 0;
        for (const u of users ?? []) {
          const m = slotMessage(slot.hour, esc(u.first_name || "Soldier"), giftId, u.language_code);
          const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: u.tg_id, parse_mode: "HTML", ...m }),
          });
          if (res.status === 429) break; // Telegram rate limit: stop, next run continues
          const patch: Record<string, unknown> = { notified_slot: slot.key };
          if (res.status === 403 || res.status === 400) { patch["bot_blocked"] = res.status === 403; blocked++; } else sent++;
          await db.from("wall_users").update(patch as never).eq("tg_id", u.tg_id);
          await new Promise((r) => setTimeout(r, 40));
        }
        await db.from("wall_jobs" as never).update({ locked_until: new Date().toISOString() } as never).eq("name", "daily");
        return Response.json({ ok: true, posted, slot: slot.key, sent, blocked, remaining: (users?.length ?? 0) === BATCH });
      },
    },
  },
});

// One channel post per day (from 14:00 UTC), in order, each exactly once. Progress rows live in wall_jobs as "post:<day>".
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function autoPost(db: any, token: string, origin: string): Promise<number | null> {
  const channel = process.env["TELEGRAM_CHANNEL_ID"];
  const now = new Date();
  if (!channel || now.getUTCHours() < 14) return null;
  const { data: rows } = await db.from("wall_jobs").select("name, locked_until").like("name", "post:%");
  const done = (rows ?? []) as { name: string; locked_until: string }[];
  const today = now.toISOString().slice(0, 10);
  if (done.some((r) => r.locked_until.slice(0, 10) === today)) return null;
  const next = POSTS.find((p) => !done.some((r) => r.name === `post:${p.day}`));
  if (!next) return null;
  const { error } = await db.from("wall_jobs").insert({ name: `post:${next.day}`, locked_until: now.toISOString() });
  if (error) return null; // another run claimed it
  const src = POST_IMAGES[`/src/assets/posts/${next.image}`];
  const img = src ? await fetch(new URL(src, origin)).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null) : null;
  if (!img) { await db.from("wall_jobs").delete().eq("name", `post:${next.day}`); console.error("post image missing", next.image); return null; }
  const send = (buttons: unknown) => {
    const fd = new FormData();
    fd.append("chat_id", channel); fd.append("caption", next.caption); fd.append("parse_mode", "HTML");
    fd.append("reply_markup", JSON.stringify({ inline_keyboard: buttons }));
    fd.append("photo", new Blob([img], { type: "image/jpeg" }), next.image);
    return fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: "POST", body: fd });
  };
  let res = await send(next.buttons);
  if (!res.ok) res = await send(next.buttons.map((r) => r.map(({ text, url }) => ({ text, url }))));
  if (!res.ok) { await db.from("wall_jobs").delete().eq("name", `post:${next.day}`); console.error("post failed", await res.text()); return null; }
  return next.day;
}
