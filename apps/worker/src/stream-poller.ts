import { prisma } from "@nexaly/database";
import {
  DEFAULT_STREAM_TEMPLATE,
  DISCORD_API_BASE,
  createStreamProviders,
  interpolateStream,
} from "@nexaly/shared";
import type Redis from "ioredis";
import { createLogger } from "@nexaly/logger";

const log = createLogger("stream-poller");

export async function pollStreams(redis: Redis): Promise<void> {
  const providers = createStreamProviders({
    TWITCH_CLIENT_ID: process.env.TWITCH_CLIENT_ID,
    TWITCH_CLIENT_SECRET: process.env.TWITCH_CLIENT_SECRET,
    YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
    KICK_CLIENT_ID: process.env.KICK_CLIENT_ID,
    KICK_CLIENT_SECRET: process.env.KICK_CLIENT_SECRET,
  });
  const token = process.env.DISCORD_TOKEN;
  if (!token) return;

  const subs = await prisma.streamSubscription.findMany({ where: { enabled: true } });
  for (const sub of subs) {
    const provider = providers[sub.platform];
    if (!provider.configured()) continue;
    try {
      const status = await provider.getLiveStatus(sub.externalId);
      const liveKey = `stream:live:${sub.guildId}:${sub.platform}:${sub.externalId}`;
      const wasLive = Boolean(await redis.get(liveKey));
      if (status.live && !wasLive) {
        await redis.set(liveKey, "1", "EX", 6 * 3600);
        const text = interpolateStream(sub.template || DEFAULT_STREAM_TEMPLATE, {
          streamer: sub.displayName,
          platform: sub.platform.toLowerCase(),
          title: status.title ?? "Live",
          url: status.url ?? platformUrl(sub.platform, sub.channelKey),
          game: status.game,
        });
        const everyone = sub.mentionRoleId === sub.guildId;
        const mention = !sub.mentionRoleId ? "" : everyone ? "@everyone " : `<@&${sub.mentionRoleId}> `;
        await fetch(`${DISCORD_API_BASE}/channels/${sub.announceChannelId}/messages`, {
          method: "POST",
          headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            content: `${mention}${text}`,
            allowed_mentions: !sub.mentionRoleId
              ? { parse: [] }
              : everyone
                ? { parse: ["everyone"] }
                : { roles: [sub.mentionRoleId] },
          }),
        });
        await prisma.streamSubscription.update({
          where: { id: sub.id },
          data: { lastLiveAt: new Date() },
        });
      } else if (!status.live && wasLive) {
        await redis.del(liveKey);
        await prisma.streamSubscription.update({
          where: { id: sub.id },
          data: { lastOfflineAt: new Date() },
        });
      }
    } catch (error) {
      log.error({ err: error, platform: sub.platform, channel: sub.channelKey }, "poll failed");
    }
  }
}

function platformUrl(platform: string, key: string): string {
  if (platform === "TWITCH") return `https://twitch.tv/${key}`;
  if (platform === "KICK") return `https://kick.com/${key}`;
  return `https://www.youtube.com/channel/${key}`;
}
