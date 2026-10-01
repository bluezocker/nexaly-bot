import { notFound } from "@nexaly/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppDeps } from "../app.js";
import { requireDiscordToken, requireUser } from "../app.js";
import { fetchGuildChannels, TEXT_CHANNEL_TYPES } from "../services/discord-bot-rest.js";
import { fetchCurrentUserGuilds } from "../services/discord-oauth.js";
import { ensureGuildAccess } from "../services/guilds.js";

const guildParams = z.object({ guildId: z.string().regex(/^\d{17,20}$/) });

export async function registerChannelRoutes(app: FastifyInstance, deps: AppDeps): Promise<void> {
  app.get("/v1/guilds/:guildId/channels", async (request) => {
    const params = guildParams.parse(request.params);
    const { userId, sessionId } = await requireUser(request);
    const accessToken = await requireDiscordToken(deps.redis, sessionId);
    const oauthGuilds = await fetchCurrentUserGuilds(deps.redis, userId, accessToken);
    await ensureGuildAccess({
      prisma: deps.prisma,
      userId,
      guildId: params.guildId,
      oauthGuilds,
    });

    const installed = await deps.prisma.guild.findUnique({ where: { id: params.guildId } });
    if (!installed) throw notFound("Bot is not installed on this server yet");
    if (!deps.env.DISCORD_TOKEN) {
      return { channels: [] };
    }

    const channels = await fetchGuildChannels(deps.env.DISCORD_TOKEN, params.guildId);
    return {
      channels: channels
        .filter((channel) => TEXT_CHANNEL_TYPES.has(channel.type))
        .map((channel) => ({
          id: channel.id,
          name: channel.name,
          type: channel.type,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      categories: channels
        .filter((channel) => channel.type === 4)
        .map((channel) => ({ id: channel.id, name: channel.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  });
}
