// Telegram Mini App identity: verifies initData signed by our bot (HMAC-SHA256).
export type TgUser = { id: number; first_name?: string; username?: string; photo_url?: string; language_code?: string };

const enc = new TextEncoder();

async function hmac(key: ArrayBuffer | Uint8Array<ArrayBuffer>, msg: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", k, enc.encode(msg));
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 7 * 24 * 3600,
): Promise<{ user: TgUser; startParam: string | null }> {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) throw new Error("unauthorized");
  params.delete("hash");
  const check = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");
  const secret = await hmac(enc.encode("WebAppData"), botToken);
  const expected = toHex(await hmac(secret, check));
  if (expected !== hash) throw new Error("unauthorized");
  const authDate = Number(params.get("auth_date") ?? 0);
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSeconds) throw new Error("unauthorized");
  const user = JSON.parse(params.get("user") ?? "null") as TgUser | null;
  if (!user?.id) throw new Error("unauthorized");
  return { user, startParam: params.get("start_param") };
}

/** true = member, false = not a member, null = bot can't see the member list (not admin). */
export async function isChatMember(botToken: string, chatId: string, userId: number): Promise<boolean | null> {
  const res = await fetch(
    `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${encodeURIComponent(chatId)}&user_id=${userId}`,
  );
  const body = (await res.json().catch(() => null)) as { ok?: boolean; result?: { status?: string } } | null;
  if (!body?.ok) return null;
  const status = body.result?.status;
  return status === "member" || status === "administrator" || status === "creator" || status === "restricted";
}
