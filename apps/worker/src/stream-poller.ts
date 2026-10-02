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

/** Solange ein Stream live gesehen wird, wird dieser Schlüssel immer wieder verlängert. */
const LIVE_KEY_TTL_SEC = 2 * 3600;
/** YouTube nur alle 3 Minuten pro Kanal prüfen (spart API-Kontingent). */
const YOUTUBE_MIN_INTERVAL_SEC = 180;

// Einmal pro Prozess erzeugen, damit das Twitch/Kick-App-Token zwischen den Durchläufen gecacht bleibt.
const providers = createStreamProviders({
  TWITCH_CLIENT_ID: process.env.TWITCH_CLIENT_ID,
  TWITCH_CLIENT_SECRET: process.env.TWITCH_CLIENT_SECRET,
  YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
  KICK_CLIENT_ID: process.env.KICK_CLIENT_ID,
  KICK_CLIENT_SECRET: process.env.KICK_CLIENT_SECRET,
});

type LiveStatus = Awaited<ReturnType<(typeof providers)["TWITCH"]["getLiveStatus"]>>;

let running = false;

export async function pollStreams(redis: Redis): Promise<void> {
  // Verhindert, dass sich langsame Durchläufe überlappen und doppelt ankündigen.
  if (running) {
    log.warn("previous stream poll still running, skipping");
    return;
  }
  running = true;
  try {
    await pollOnce(redis);
  } finally {
    running = false;
  }
}

async function pollOnce(redis: Redis): Promise<void> {
  const token = process.env.DISCORD_TOKEN;
  if (!token) return;

  const subs = await prisma.streamSubscription.findMany({ where: { enabled: true } });
  // Mehrere Server können denselben Kanal abonnieren – pro Durchlauf nur einmal abfragen.
  const statusCache = new Map<string, Promise<LiveStatus | null>>();

  const statusFor = (platform: keyof typeof providers, externalId: string) => {
    const cacheKey = `${platform}:${externalId}`;
    let pending = statusCache.get(cacheKey);
    if (!pending) {
      pending = (async () => {
        if (platform === "YOUTUBE") {
          const fresh = await redis.set(
            `stream:yt:checked:${externalId}`,
            "1",
            "EX",
            YOUTUBE_MIN_INTERVAL_SEC,
            "NX",
          );
          if (!fresh) return null; // in diesem Durchlauf nicht prüfen
        }
        return providers[platform].getLiveStatus(externalId);
      })();
      statusCache.set(cacheKey, pending);
    }
    return pending;
  };

  for (const sub of subs) {
    const platform = sub.platform as keyof typeof providers;
    const provider = providers[platform];
    if (!provider?.configured()) continue;
    try {
      const status = await statusFor(platform, sub.externalId);
      if (!status) continue;
      const liveKey = `stream:live:${sub.guildId}:${sub.platform}:${sub.externalId}`;
      const wasLive = Boolean(await redis.get(liveKey));

      if (status.live && wasLive) {
        await redis.expire(liveKey, LIVE_KEY_TTL_SEC);
      } else if (status.live && !wasLive) {
        await redis.set(liveKey, "1", "EX", LIVE_KEY_TTL_SEC);
        const text = interpolateStream(sub.template || DEFAULT_STREAM_TEMPLATE, {
          streamer: sub.displayName,
          platform: sub.platform.toLowerCase(),
          title: status.title ?? "Live",
          url: status.url ?? platformUrl(sub.platform, sub.channelKey),
          game: status.game,
        });
        const everyone = sub.mentionRoleId === sub.guildId;
        const mention = !sub.mentionRoleId ? "" : everyone ? "@everyone " : `<@&${sub.mentionRoleId}> `;
        const response = await fetch(`${DISCORD_API_BASE}/channels/${sub.announceChannelId}/messages`, {
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
        if (!response.ok) {
          const body = await response.text().catch(() => "");
          log.error(
            { status: response.status, body: body.slice(0, 300), guildId: sub.guildId, channelId: sub.announceChannelId },
            "stream announcement failed",
          );
          // Bei Rate-Limit/Serverfehler im nächsten Durchlauf erneut versuchen.
          // Bei 403/404 (fehlende Rechte, Kanal gelöscht) nicht jede Minute neu spammen.
          if (response.status === 429 || response.status >= 500) await redis.del(liveKey);
          continue;
        }
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
