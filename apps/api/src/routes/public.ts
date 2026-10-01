import type { FastifyInstance } from "fastify";
import type { AppDeps } from "../app.js";

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
}
