import { notFound } from "@nexaly/shared";
import type { FastifyInstance } from "fastify";
import type { AppDeps } from "../app.js";
import { loadPublicLeaderboard, publicLeaderboardCacheKey } from "../services/leaderboard.js";

function iconUrl(guildId: string, icon: string | null): string | null {
  if (!icon) return null;
  const ext = icon.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/icons/${guildId}/${icon}.${ext}?size=128`;
}

export async function registerPublicRoutes(app: FastifyInstance, deps: AppDeps): Promise<void> {
  app.get("/v1/public/servers", async () => {
    const cacheKey = "public:servers:v2";
    const cached = await deps.redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as unknown;

    const rows = await deps.prisma.guild.findMany({
      select: { id: true, name: true, icon: true, memberCount: true },
      orderBy: { name: "asc" },
      take: 200,
    });

    const payload = {
      count: rows.length,
      servers: rows.map((row) => ({
        name: row.name,
        iconUrl: iconUrl(row.id, row.icon),
        memberCount: row.memberCount,
      })),
    };
    if (payload.count > 0) {
      await deps.redis.set(cacheKey, JSON.stringify(payload), "EX", 30);
    }
    return payload;
  });

  app.get("/v1/public/leaderboard/:guildId", async (request) => {
    const { guildId } = request.params as { guildId: string };
    if (!/^\d{17,20}$/.test(guildId)) throw notFound("Rangliste nicht gefunden");

    const cacheKey = publicLeaderboardCacheKey(guildId);
    const cached = await deps.redis.get(cacheKey);
    if (cached) {
      const value = JSON.parse(cached) as unknown;
      if (value === null) throw notFound("Rangliste nicht gefunden");
      return value;
    }

    const payload = await loadPublicLeaderboard(deps.prisma, guildId);
    // Auch "nicht vorhanden" kurz merken, damit wahllose Aufrufe die Datenbank nicht belasten.
    await deps.redis.set(cacheKey, JSON.stringify(payload), "EX", payload ? 60 : 30);
    if (!payload) throw notFound("Rangliste nicht gefunden");
    return payload;
  });
}
