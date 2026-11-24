import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authPlayer } from "./tasks.functions";

export const getMyProfile = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ initData: z.string().min(10).max(4096), page: z.number().int().min(0).default(0) }).parse(input))
  .handler(async ({ data }) => {
    const { user, db } = await authPlayer(data.initData);
    const [profile, team] = await Promise.all([
      db.from("wall_users").select("first_name, username, photo_url, tg_id, created_at, total_level").eq("tg_id", user.id).single(),
      db.from("wall_users").select("first_name, photo_url, total_level, created_at", { count: "exact" }).eq("referrer_id", user.id).order("created_at", { ascending: false }).range(data.page * 20, data.page * 20 + 19),
    ]);
    if (profile.error) throw new Error(profile.error.message);
    if (team.error) throw new Error(team.error.message);
    return { profile: profile.data, team: team.data ?? [], teamCount: team.count ?? 0 };
  });