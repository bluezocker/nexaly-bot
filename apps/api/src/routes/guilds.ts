import {
  MODULE_KEYS,
  MODULE_LABELS,
  configChannel,
  guildSettingsUpdateSchema,
  notFound,
  validationError,
} from "@nexaly/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppDeps } from "../app.js";
import { requireDiscordToken, requireUser } from "../app.js";
import { fetchGuildRoles } from "../services/discord-bot-rest.js";
import { fetchCurrentUserGuilds } from "../services/discord-oauth.js";
import { ensureGuildAccess, listManageableGuilds } from "../services/guilds.js";

const guildParams = z.object({ guildId: z.string().regex(/^\d{17,20}$/) });

export async function registerGuildRoutes(app: FastifyInstance, deps: AppDeps): Promise<void> {
  app.get("/v1/guilds", async (request) => {
    const { userId, sessionId } = await requireUser(request);
    const accessToken = await requireDiscordToken(deps.redis, sessionId);
    const oauthGuilds = await fetchCurrentUserGuilds(deps.redis, userId, accessToken);
    const guilds = await listManageableGuilds({
      prisma: deps.prisma,
      userId,
      oauthGuilds,
      clientId: deps.env.DISCORD_CLIENT_ID,
    });
    return { guilds };
  });

  app.get("/v1/guilds/:guildId", async (request) => {
    const { userId, sessionId } = await requireUser(request);
    const params = guildParams.parse(request.params);
    const accessToken = await requireDiscordToken(deps.redis, sessionId);
    const oauthGuilds = await fetchCurrentUserGuilds(deps.redis, userId, accessToken);
    await ensureGuildAccess({
      prisma: deps.prisma,
      userId,
      guildId: params.guildId,
      oauthGuilds,
    });
    const guild = await deps.prisma.guild.findUnique({
      where: { id: params.guildId },
      include: { settings: true, modules: true },
    });
    if (!guild) throw notFound("Bot is not installed on this server yet");
    return {
      id: guild.id,
      name: guild.name,
      icon: guild.icon,
      ownerId: guild.ownerId,
      memberCount: guild.memberCount,
      botJoinedAt: guild.botJoinedAt ? guild.botJoinedAt.toISOString() : null,
      settings: guild.settings,
      modules: guild.modules,
    };
  });

  app.get("/v1/guilds/:guildId/settings", async (request) => {
    const { userId, sessionId } = await requireUser(request);
    const params = guildParams.parse(request.params);
    const accessToken = await requireDiscordToken(deps.redis, sessionId);
    const oauthGuilds = await fetchCurrentUserGuilds(deps.redis, userId, accessToken);
    await ensureGuildAccess({
      prisma: deps.prisma,
      userId,
      guildId: params.guildId,
      oauthGuilds,
    });
    const guild = await deps.prisma.guild.findUnique({
      where: { id: params.guildId },
      include: { settings: true, modules: true },
    });
    if (!guild) throw notFound("Bot is not installed on this server yet");

    const moduleMap = new Map(guild.modules.map((row) => [row.key, row.enabled]));
    const modules = MODULE_KEYS.map((key) => ({
      key,
      label: MODULE_LABELS[key],
      enabled: moduleMap.get(key) ?? false,
    }));

    let roles: { id: string; name: string; color: number; managed: boolean }[] = [];
    const cacheKey = `bot:roles:${params.guildId}`;
    const cached = await deps.redis.get(cacheKey);
    if (cached) {
      roles = JSON.parse(cached) as typeof roles;
    } else if (deps.env.DISCORD_TOKEN) {
      try {
        const raw = await fetchGuildRoles(deps.env.DISCORD_TOKEN, params.guildId);
        roles = raw
          .filter((role) => role.name !== "@everyone")
          .sort((a, b) => b.position - a.position)
          .map((role) => ({
            id: role.id,
            name: role.name,
            color: role.color,
            managed: role.managed,
          }));
        await deps.redis.set(cacheKey, JSON.stringify(roles), "EX", 60);
      } catch {
        roles = [];
      }
    }

    return {
      locale: guild.settings?.locale ?? "de",
      timezone: guild.settings?.timezone ?? "Europe/Berlin",
      managerRoleIds: guild.settings?.managerRoleIds ?? [],
      dataRetentionDays: guild.settings?.dataRetentionDays ?? 90,
      deletedMessageLogDays: guild.settings?.deletedMessageLogDays ?? 30,
      modules,
      roles,
    };
  });

  app.put("/v1/guilds/:guildId/settings", async (request) => {
    const { userId, sessionId } = await requireUser(request);
    const params = guildParams.parse(request.params);
    const accessToken = await requireDiscordToken(deps.redis, sessionId);
    const oauthGuilds = await fetchCurrentUserGuilds(deps.redis, userId, accessToken);
    await ensureGuildAccess({
      prisma: deps.prisma,
      userId,
      guildId: params.guildId,
      oauthGuilds,
    });
    const parsed = guildSettingsUpdateSchema.safeParse(request.body);
    if (!parsed.success) throw validationError("Invalid guild settings", parsed.error.issues);
    const guild = await deps.prisma.guild.findUnique({ where: { id: params.guildId } });
    if (!guild) throw validationError("Bot is not installed on this server");
    const data = parsed.data;

    await deps.prisma.$transaction(async (tx) => {
      await tx.guildSettings.upsert({
        where: { guildId: params.guildId },
        create: {
          guildId: params.guildId,
          locale: data.locale,
          timezone: data.timezone,
          managerRoleIds: data.managerRoleIds,
          dataRetentionDays: data.dataRetentionDays,
          deletedMessageLogDays: data.deletedMessageLogDays,
        },
        update: {
          locale: data.locale,
          timezone: data.timezone,
          managerRoleIds: data.managerRoleIds,
          dataRetentionDays: data.dataRetentionDays,
          deletedMessageLogDays: data.deletedMessageLogDays,
        },
      });
      for (const mod of data.modules) {
        await tx.guildModule.upsert({
          where: { guildId_key: { guildId: params.guildId, key: mod.key } },
          create: { guildId: params.guildId, key: mod.key, enabled: mod.enabled },
          update: { enabled: mod.enabled },
        });
      }
      await tx.auditEntry.create({
        data: { guildId: params.guildId, actorId: userId, action: "settings.update" },
      });
    });

    await deps.redis.publish(configChannel(params.guildId), JSON.stringify({ module: "settings" }));
    return { ok: true };
  });
}
