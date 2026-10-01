import { createStreamProviders, streamSubscriptionSchema, validationError } from "@nexaly/shared";
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

export async function registerStreamRoutes(app: FastifyInstance, deps: AppDeps): Promise<void> {
  const providers = createStreamProviders(deps.env);

  app.get("/v1/guilds/:guildId/streams", async (request) => {
    const params = guildParams.parse(request.params);
    await authorize(deps, request, params.guildId);
    const subscriptions = await deps.prisma.streamSubscription.findMany({
      where: { guildId: params.guildId },
    });
    return {
      subscriptions,
      providers: {
        TWITCH: providers.TWITCH.configured(),
        YOUTUBE: providers.YOUTUBE.configured(),
        KICK: providers.KICK.configured(),
      },
    };
  });

  app.post("/v1/guilds/:guildId/streams", async (request) => {
    const params = guildParams.parse(request.params);
    await authorize(deps, request, params.guildId);
    const parsed = streamSubscriptionSchema.safeParse(request.body);
    if (!parsed.success) throw validationError("Invalid stream subscription", parsed.error.issues);
    const provider = providers[parsed.data.platform];
    if (!provider.configured()) {
      throw validationError(`${parsed.data.platform} is not configured on the server`);
    }
    const channel = await provider.validateChannel(parsed.data.channelKey);
    const created = await deps.prisma.streamSubscription.create({
      data: {
        guildId: params.guildId,
        platform: parsed.data.platform,
        channelKey: channel.channelKey,
        externalId: channel.externalId,
        displayName: channel.displayName,
        announceChannelId: parsed.data.announceChannelId,
        mentionRoleId: parsed.data.mentionRoleId,
        template: parsed.data.template,
        enabled: parsed.data.enabled,
      },
    });
    return { subscription: created };
  });

  app.delete("/v1/guilds/:guildId/streams/:subId", async (request) => {
    const params = subParams.parse(request.params);
    await authorize(deps, request, params.guildId);
    const deleted = await deps.prisma.streamSubscription.deleteMany({
      where: { id: params.subId, guildId: params.guildId },
    });
    if (!deleted.count) throw validationError("Subscription not found");
    return { ok: true };
  });
}
