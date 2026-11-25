import { bt, type BotKey } from "@/lib/bot-i18n";
import { createFileRoute } from "@tanstack/react-router";
import cover from "@/assets/brand/bot-start-cover.jpg?inline";

const APP_URL = "https://t.me/Mixsaabot?startapp";
const GROUP = "https://t.me/micahub";
const COMMUNITY = "https://t.me/oraien";
// The Mini App's published address; the admin page itself re-checks the admin role on every request.
const ADMIN_ORIGIN = "https://anime-coin-adventure.lovable.app";

// Animated custom emoji from the owner's packs (falls back to the plain emoji if Telegram refuses).
const e = (id: string, alt: string) => `<tg-emoji emoji-id="${id}">${alt}</tg-emoji>`;
const E = {
  fire: e("5046769637191058547", "🔥"),
  coin: e("5127453140467058523", "🪙"),
  gem: e("5127459531378394661", "💎"),
  star: e("5409271925014801629", "🌟"),
  gift: e("6032937473162614352", "🎁"),
  news: e("4992560350982309130", "📣"),
  bolt: e("5046752770854487087", "⚡️"),
  ok: e("5406690851533370477", "✅"),
};

async function secretFor(token: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`tg-webhook:${token}`));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function startText(name: string, lang?: string) {
  const t = (k: BotKey, v?: Record<string, string>) => bt(lang, k, v);
  return [
    `<b>${E.fire} ${t("welcome", { name })}</b>`,
    "",
    `<b>${t("calling")}</b>`,
    "",
    `<b>${E.coin} ${t("mine")}</b> — ${t("mineSub")}`,
    `<b>${E.gift} ${t("nft")}</b> — ${t("nftSub")}`,
    `<b>${E.bolt} ${t("story")}</b> — ${t("storySub")}`,
    `<b>${E.gem} ${t("listed")}</b>`,
    "",
    `<b>${E.star} ${t("tap")}</b>`,
  ].join("\n");
}

const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!);

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env["TELEGRAM_BOT_TOKEN"];
        if (!token) return new Response("not configured", { status: 500 });
        if (request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== (await secretFor(token))) {
          return new Response("Unauthorized", { status: 401 });
        }
        const update = (await request.json().catch(() => null)) as {
          message?: { chat?: { id?: number; type?: string }; text?: string; write_access_allowed?: object; from?: { id?: number; first_name?: string; language_code?: string } };
          my_chat_member?: { chat?: { id?: number; type?: string; title?: string; username?: string }; from?: { id?: number }; new_chat_member?: { status?: string; can_post_messages?: boolean } };
        } | null;
        const member = update?.my_chat_member;
        if (member?.chat?.type === "channel" && member.chat.id && member.from?.id) {
          const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
          if (member.new_chat_member?.status === "administrator" && member.new_chat_member.can_post_messages) {
            const res = await fetch(`https://api.telegram.org/bot${token}/getChatAdministrators?chat_id=${member.chat.id}`);
            const json = res.ok ? ((await res.json().catch(() => null)) as { result?: { user?: { id?: number } }[] } | null) : null;
            const isAdmin = (json?.result ?? []).some((a) => a.user?.id === member.from?.id);
            if (isAdmin) {
              await db.rpc("wall_partner_register", { _tg: member.from.id, _chat: member.chat.id, _title: member.chat.title ?? "Channel", ...(member.chat.username ? { _username: member.chat.username } : {}) });
            }
          } else {
            await db.from("wall_partner_channels").update({ status: "paused" }).eq("chat_id", member.chat.id);
          }
          return Response.json({ ok: true });
        }
        const cb = (update as { callback_query?: { id: string; data?: string; from: { id: number; language_code?: string } } } | null)?.callback_query;
        if (cb?.data?.startsWith("gift:")) {
          const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
          const { data, error } = await db.rpc("wall_claim_gift" as never, { _gift: cb.data.slice(5), _tg: cb.from.id } as never);
          const m = error?.message ?? "";
          const cl = cb.from?.language_code;
          const text = !error ? `🎁 ${bt(cl, "giftOk", { coins: Number(data) })}`
            : bt(cl, m.includes("gift_claimed") ? "giftDone" : m.includes("gift_expired") ? "giftExp" : m.includes("no_user") ? "giftNoUser" : "oops");
          await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callback_query_id: cb.id, text, show_alert: true }),
          });
          return Response.json({ ok: true });
        }
        const msg = update?.message;
        // Only Telegram's verified private-chat event can restore notification
        // eligibility after a player explicitly grants access or starts the bot.
        if (msg?.chat?.type === "private" && msg.from?.id === msg.chat.id &&
            (msg.write_access_allowed || (typeof msg.text === "string" && /^\/start(?:@\w+)?(?:\s|$)/.test(msg.text)))) {
          const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
          const { error } = await db.from("wall_users").update({ bot_blocked: false } as never).eq("tg_id", msg.from?.id ?? 0);
          if (error) return Response.json({ error: "Could not save message permission" }, { status: 500 });
        }
        // /101: admins get a button that opens the admin panel inside Telegram. Everyone else gets no answer.
        if (msg?.chat?.id && typeof msg.text === "string" && /^\/101(@\w+)?$/.test(msg.text.trim())) {
          const from = (msg as { from?: { username?: string } }).from;
          const name = (from?.username ?? "").toLowerCase();
          const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
          const { data: adm } = name ? await db.from("wall_admins" as never).select("role").eq("username", name).maybeSingle() : { data: null };
          if (adm) {
            const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: msg.chat.id, parse_mode: "HTML",
                text: "<b>🛠 Admin panel</b>\nTap the button to open it.",
                reply_markup: { inline_keyboard: [[{ text: "🛠 Open admin panel", web_app: { url: `${ADMIN_ORIGIN}/101` } }]] },
              }),
            });
            console.log("admin /101 reply", r.status, (await r.text()).slice(0, 200));
          }
          return Response.json({ ok: true });
        }
        if (msg?.chat?.id && typeof msg.text === "string" && msg.text.startsWith("/start")) {
          const chatId = msg.chat!.id;
          const lang = msg.from?.language_code;
          // Premium animated emoji on each button; plain emoji kept for a fallback if Telegram refuses them.
          const btn = (icon: string, alt: string, text: string, url: string, style: string) => ({ text, alt, url, style, icon_custom_emoji_id: icon });
          const rows = [
            [btn("5046752770854487087", "⚔️", bt(lang, "open"), APP_URL, "primary")],
            [btn("5046769637191058547", "👥", bt(lang, "group"), GROUP, "success"), btn("4992560350982309130", "📢", bt(lang, "community"), COMMUNITY, "success")],
            [btn("5127459531378394661", "💎", bt(lang, "binance"), "https://www.binance.com/en/trade/ANIME_USDT", "danger")],
          ];
          const premium = { inline_keyboard: rows.map((r) => r.map(({ alt: _a, ...b }) => b)) };
          const basic = { inline_keyboard: rows.map((r) => r.map(({ alt, text, url, style }) => ({ text: `${alt} ${text}`, url, style }))) };
          let reply_markup: object = premium;
          const api = `https://api.telegram.org/bot${token}`;
          // Upload the photo bytes directly so no public image link is needed.
          const sendPhoto = (caption: string) => {
            const b64 = cover.slice(cover.indexOf(",") + 1);
            const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
            const fd = new FormData();
            fd.append("chat_id", String(chatId));
            fd.append("parse_mode", "HTML");
            fd.append("caption", caption);
            fd.append("reply_markup", JSON.stringify(reply_markup));
            fd.append("photo", new Blob([bytes], { type: "image/jpeg" }), "mikasa.jpg");
            return fetch(`${api}/sendPhoto`, { method: "POST", body: fd });
          };
          const caption = startText(esc(msg.from?.first_name || "Soldier"), lang);
          const plain = caption.replace(/<tg-emoji[^>]*>(.*?)<\/tg-emoji>/g, "$1");
          let res = await sendPhoto(caption);
          if (!res.ok) { console.error("start photo", res.status, await res.text()); reply_markup = basic; res = await sendPhoto(caption); }
          if (!res.ok) { console.error("start photo basic", res.status, await res.text()); res = await sendPhoto(plain); }
          if (!res.ok) {
            console.error("start photo plain", res.status, await res.text());
            // Last resort: text only, so /start always answers.
            await fetch(`${api}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: chatId, parse_mode: "HTML", text: plain, reply_markup }),
            });
          }
        }
        return Response.json({ ok: true });
      },
    },
  },
});
