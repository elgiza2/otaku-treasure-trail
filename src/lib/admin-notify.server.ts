type Db = { from: (t: never) => any };

/** Sends a payment alert to every owner admin who has opened the bot. Never throws. */
export async function notifyOwnersOfPayment(db: Db, p: { pack: string; amount_nano: number | string; tg_id: number | string }) {
  try {
    const token = process.env["TELEGRAM_BOT_TOKEN"];
    if (!token) return;
    const { data: owners } = await db.from("wall_admins" as never).select("username").eq("role", "owner");
    const names = ((owners ?? []) as { username: string }[]).map((o) => o.username);
    if (!names.length) return;
    const { data: users } = await db.from("wall_users" as never).select("tg_id, username").in("username", names);
    const { data: buyer } = await db.from("wall_users" as never).select("username, first_name").eq("tg_id", p.tg_id).maybeSingle();
    const who = buyer?.username ? `@${buyer.username}` : (buyer?.first_name || String(p.tg_id));
    const text = `<b>💰 New payment</b>\n\n<b>Pack:</b> ${p.pack}\n<b>Amount:</b> ${(Number(p.amount_nano) / 1e9).toFixed(2)} TON\n<b>Player:</b> ${who}`;
    await Promise.all(((users ?? []) as { tg_id: number }[]).map((u) =>
      fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: u.tg_id, parse_mode: "HTML", text }),
      })));
  } catch (e) {
    console.error("payment notify failed", e);
  }
}
