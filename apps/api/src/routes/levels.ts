import { configChannel, levelSettingsUpdateSchema, validationError } from "@nexaly/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppDeps } from "../app.js";
import { requireDiscordToken, requireUser } from "../app.js";
import { fetchCurrentUserGuilds } from "../services/discord-oauth.js";
import { ensureGuildAccess } from "../services/guilds.js";
import { publicLeaderboardCacheKey } from "../services/leaderboard.js";

const guildParams = z.object({ guildId: z.string().regex(/^\d{17,20}$/) });

async function authorize(deps: AppDeps, request: Parameters<typeof requireUser>[0], guildId: string) {
  const { userId, sessionId } = await requireUser(request);
  const accessToken = await requireDiscordToken(deps.redis, sessionId);
  const oauthGuilds = await fetchCurrentUserGuilds(deps.redis, userId, accessToken);
  await ensureGuildAccess({ prisma: deps.prisma, userId, guildId, oauthGuilds });
  return { userId };
}

export async function registerLevelRoutes(app: FastifyInstance, deps: AppDeps): Promise<void> {
  app.get("/v1/guilds/:guildId/levels", async (request) => {
    const params = guildParams.parse(request.params);
    await authorize(deps, request, params.guildId);
    const [moduleRow, settings, rewards, top] = await Promise.all([
      deps.prisma.guildModule.findUnique({
        where: { guildId_key: { guildId: params.guildId, key: "levels" } },
      }),
      deps.prisma.levelSettings.findUnique({ where: { guildId: params.guildId } }),
      deps.prisma.levelReward.findMany({ where: { guildId: params.guildId }, orderBy: { level: "asc" } }),
      deps.prisma.memberLevel.findMany({
        where: { guildId: params.guildId },
        orderBy: { xp: "desc" },
        take: 15,
      }),
    ]);
    return {
      enabled: moduleRow?.enabled ?? settings?.enabled ?? false,
      settings,
      rewards,
      leaderboard: top.map((row: { userId: string; xp: number; level: number; displayName: string | null }) => ({
        userId: row.userId,
        displayName: row.displayName,
        xp: row.xp,
        level: row.level,
      })),
    };
  });

  app.put("/v1/guilds/:guildId/levels", async (request) => {
    const params = guildParams.parse(request.params);
    const { userId } = await authorize(deps, request, params.guildId);
    const parsed = levelSettingsUpdateSchema.safeParse(request.body);
    if (!parsed.success) throw validationError("Invalid level settings", parsed.error.issues);
    const guild = await deps.prisma.guild.findUnique({ where: { id: params.guildId } });
    if (!guild) throw validationError("Bot is not installed on this server");
    const data = parsed.data;

    await deps.prisma.$transaction(async (tx) => {
      await tx.guildModule.upsert({
        where: { guildId_key: { guildId: params.guildId, key: "levels" } },
        create: { guildId: params.guildId, key: "levels", enabled: data.enabled },
        update: { enabled: data.enabled },
      });
      await tx.levelSettings.upsert({
        where: { guildId: params.guildId },
        create: {
          guildId: params.guildId,
          enabled: data.enabled,
          xpMin: data.xpMin,
          xpMax: data.xpMax,
          cooldownSec: data.cooldownSec,
          announceChannelId: data.announceChannelId,
          stackRoles: data.stackRoles,
          ignoredChannelIds: data.ignoredChannelIds,
          ignoredRoleIds: data.ignoredRoleIds,
          publicLeaderboard: data.publicLeaderboard,
        },
        update: {
          enabled: data.enabled,
          xpMin: data.xpMin,
          xpMax: data.xpMax,
          cooldownSec: data.cooldownSec,
          announceChannelId: data.announceChannelId,
          stackRoles: data.stackRoles,
          ignoredChannelIds: data.ignoredChannelIds,
          ignoredRoleIds: data.ignoredRoleIds,
          publicLeaderboard: data.publicLeaderboard,
        },
      });
      await tx.levelReward.deleteMany({ where: { guildId: params.guildId } });
      if (data.rewards.length) {
        await tx.levelReward.createMany({
          data: data.rewards.map((reward) => ({
            guildId: params.guildId,
            level: reward.level,
            roleId: reward.roleId,
          })),
        });
      }
      await tx.auditEntry.create({
        data: { guildId: params.guildId, actorId: userId, action: "levels.update" },
      });
    });
    // Damit Ein-/Ausschalten der öffentlichen Rangliste sofort greift
    await deps.redis.del(publicLeaderboardCacheKey(params.guildId));
    await deps.redis.publish(configChannel(params.guildId), JSON.stringify({ module: "levels" }));
    return { ok: true };
  });
}
