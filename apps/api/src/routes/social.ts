import { lookupXUser, socialSubscriptionSchema, validationError } from "@nexaly/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppDeps } from "../app.js";
import { requireDiscordToken, requireUser } from "../app.js";
import { fetchCurrentUserGuilds } from "../services/discord-oauth.js";
import { ensureGuildAccess } from "../services/guilds.js";

const guildParams = z.object({ guildId: z.string().regex(/^\d{17,20}$/) });
const subParams = guildParams.extend({ subId: z.string().min(1) });

async function authorize(deps: AppDeps, request: Parameters<typeof requireUser>[0], guildId: string) {
  const { userId, sessionId } = await requireUser(request);
  const accessToken = await requireDiscordToken(deps.redis, sessionId);
  const oauthGuilds = await fetchCurrentUserGuilds(deps.redis, userId, accessToken);
  await ensureGuildAccess({ prisma: deps.prisma, userId, guildId, oauthGuilds });
  return { userId };
}

export async function registerSocialRoutes(app: FastifyInstance, deps: AppDeps): Promise<void> {
  app.get("/v1/guilds/:guildId/social", async (request) => {
    const params = guildParams.parse(request.params);
    await authorize(deps, request, params.guildId);
    const rows = await deps.prisma.socialSubscription.findMany({
      where: { guildId: params.guildId },
      orderBy: { createdAt: "desc" },
    });
    return {
      subscriptions: rows.map((row) => ({
        id: row.id,
        platform: row.platform,
        accountKey: row.accountKey,
        displayName: row.displayName,
        announceChannelId: row.announceChannelId,
        enabled: row.enabled,
        lastError: row.lastError,
        connected: row.platform === "X" || Boolean(row.accessToken),
      })),
      providers: {
        X: Boolean(deps.env.X_BEARER_TOKEN),
        THREADS: Boolean(deps.env.THREADS_APP_ID && deps.env.THREADS_APP_SECRET),
      },
    };
  });

  app.post("/v1/guilds/:guildId/social", async (request) => {
    const params = guildParams.parse(request.params);
    await authorize(deps, request, params.guildId);
    const parsed = socialSubscriptionSchema.safeParse(request.body);
    if (!parsed.success) throw validationError("Ungültiger X-Account", parsed.error.issues);
    if (!deps.env.X_BEARER_TOKEN) throw validationError("X ist auf dem Server nicht konfiguriert");
    const guild = await deps.prisma.guild.findUnique({ where: { id: params.guildId } });
    if (!guild) throw validationError("Bot is not installed on this server");
    let user: { id: string; username: string; name: string };
    try {
      user = await lookupXUser(deps.env.X_BEARER_TOKEN, parsed.data.handle);
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404) throw validationError("X-Account nicht gefunden");
      if (status === 401 || status === 403) throw validationError("X-API verweigert den Zugriff");
      throw validationError("X-Account konnte nicht geprüft werden");
    }
    const created = await deps.prisma.socialSubscription.upsert({
      where: {
        guildId_platform_accountKey: {
          guildId: params.guildId,
          platform: "X",
          accountKey: user.username.toLowerCase(),
        },
      },
      create: {
        guildId: params.guildId,
        platform: "X",
        accountKey: user.username.toLowerCase(),
        externalId: user.id,
        displayName: user.name || user.username,
        announceChannelId: parsed.data.announceChannelId,
      },
      update: {
        externalId: user.id,
        displayName: user.name || user.username,
        announceChannelId: parsed.data.announceChannelId,
        enabled: true,
        lastError: null,
      },
    });
    await deps.prisma.guildModule.upsert({
      where: { guildId_key: { guildId: params.guildId, key: "social" } },
      create: { guildId: params.guildId, key: "social", enabled: true },
      update: { enabled: true },
    });
    return {
      subscription: {
        id: created.id,
        platform: created.platform,
        accountKey: created.accountKey,
        displayName: created.displayName,
        announceChannelId: created.announceChannelId,
        enabled: created.enabled,
        lastError: created.lastError,
        connected: true,
      },
    };
  });

  app.delete("/v1/guilds/:guildId/social/:subId", async (request) => {
    const params = subParams.parse(request.params);
    await authorize(deps, request, params.guildId);
    const deleted = await deps.prisma.socialSubscription.deleteMany({
      where: { id: params.subId, guildId: params.guildId },
    });
    if (!deleted.count) throw validationError("Eintrag nicht gefunden");
    return { ok: true };
  });
}
