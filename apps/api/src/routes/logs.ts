import {
  LOG_EVENT_KEYS,
  LOG_EVENTS,
  configChannel,
  logSettingsUpdateSchema,
  validationError,
} from "@nexaly/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppDeps } from "../app.js";
import { requireDiscordToken, requireUser } from "../app.js";
import { fetchCurrentUserGuilds } from "../services/discord-oauth.js";
import { ensureGuildAccess } from "../services/guilds.js";

const guildParams = z.object({ guildId: z.string().regex(/^\d{17,20}$/) });

async function authorizeGuild(app: AppDeps, request: Parameters<typeof requireUser>[0], guildId: string) {
  const { userId, sessionId } = await requireUser(request);
  const accessToken = await requireDiscordToken(app.redis, sessionId);
  const oauthGuilds = await fetchCurrentUserGuilds(app.redis, userId, accessToken);
  await ensureGuildAccess({ prisma: app.prisma, userId, guildId, oauthGuilds });
  return { userId };
}

function emptyEvents() {
  return Object.fromEntries(
    LOG_EVENT_KEYS.map((key) => [key, { enabled: false, channelId: null as string | null }]),
  );
}

export async function registerLogRoutes(app: FastifyInstance, deps: AppDeps): Promise<void> {
  app.get("/v1/guilds/:guildId/logs", async (request) => {
    const params = guildParams.parse(request.params);
    await authorizeGuild(deps, request, params.guildId);

    const [moduleRow, settings] = await Promise.all([
      deps.prisma.guildModule.findUnique({
        where: { guildId_key: { guildId: params.guildId, key: "logs" } },
      }),
      deps.prisma.logEventSetting.findMany({ where: { guildId: params.guildId } }),
    ]);

    const events = emptyEvents();
    for (const row of settings) {
      if (row.eventKey in events) {
        events[row.eventKey] = { enabled: row.enabled, channelId: row.channelId };
      }
    }

    return {
      enabled: moduleRow?.enabled ?? false,
      events,
      catalog: LOG_EVENTS,
    };
  });

  app.put("/v1/guilds/:guildId/logs", async (request) => {
    const params = guildParams.parse(request.params);
    const { userId } = await authorizeGuild(deps, request, params.guildId);
    const parsed = logSettingsUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      throw validationError("Invalid log settings", parsed.error.issues);
    }

    const guild = await deps.prisma.guild.findUnique({ where: { id: params.guildId } });
    if (!guild) {
      throw validationError("Bot is not installed on this server");
    }

    await deps.prisma.$transaction(async (tx) => {
      await tx.guildModule.upsert({
        where: { guildId_key: { guildId: params.guildId, key: "logs" } },
        create: { guildId: params.guildId, key: "logs", enabled: parsed.data.enabled },
        update: { enabled: parsed.data.enabled },
      });
      await tx.logSettings.upsert({
        where: { guildId: params.guildId },
        create: { guildId: params.guildId },
        update: {},
      });

      for (const key of LOG_EVENT_KEYS) {
        const setting = parsed.data.events[key];
        if (!setting) continue;
        await tx.logEventSetting.upsert({
          where: { guildId_eventKey: { guildId: params.guildId, eventKey: key } },
          create: {
            guildId: params.guildId,
            eventKey: key,
            enabled: setting.enabled,
            channelId: setting.channelId,
          },
          update: { enabled: setting.enabled, channelId: setting.channelId },
        });
      }

      await tx.auditEntry.create({
        data: {
          guildId: params.guildId,
          actorId: userId,
          action: "logs.update",
          diff: parsed.data as object,
        },
      });
    });

    await deps.redis.publish(configChannel(params.guildId), JSON.stringify({ module: "logs" }));

    return { ok: true };
  });

  app.get("/v1/guilds/:guildId/logs/recent", async (request) => {
    const params = guildParams.parse(request.params);
    await authorizeGuild(deps, request, params.guildId);
    const rows = await deps.prisma.logEvent.findMany({
      where: { guildId: params.guildId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, eventKey: true, actorId: true, createdAt: true, payload: true },
    });
    return { events: rows };
  });
}
