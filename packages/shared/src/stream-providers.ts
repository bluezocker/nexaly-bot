import type { LiveStreamInfo, StreamChannelInfo, StreamPlatform, StreamProvider } from "./streams.js";

export interface StreamProviderEnv {
  TWITCH_CLIENT_ID?: string;
  TWITCH_CLIENT_SECRET?: string;
  YOUTUBE_API_KEY?: string;
  KICK_CLIENT_ID?: string;
  KICK_CLIENT_SECRET?: string;
}

class NotConfiguredError extends Error {
  constructor(platform: string) {
    super(`${platform} credentials are not configured`);
  }
}

export function createStreamProviders(env: StreamProviderEnv): Record<StreamPlatform, StreamProvider> {
  return {
    TWITCH: twitchProvider(env),
    YOUTUBE: youtubeProvider(env),
    KICK: kickProvider(env),
  };
}

function twitchProvider(env: StreamProviderEnv): StreamProvider {
  let appToken: { value: string; exp: number } | null = null;

  async function token(): Promise<string> {
    if (!env.TWITCH_CLIENT_ID || !env.TWITCH_CLIENT_SECRET) throw new NotConfiguredError("Twitch");
    if (appToken && appToken.exp > Date.now() + 30_000) return appToken.value;
    const body = new URLSearchParams({
      client_id: env.TWITCH_CLIENT_ID,
      client_secret: env.TWITCH_CLIENT_SECRET,
      grant_type: "client_credentials",
    });
    const response = await fetch("https://id.twitch.tv/oauth2/token", { method: "POST", body });
    if (!response.ok) throw new Error(`Twitch token failed: ${response.status}`);
    const json = (await response.json()) as { access_token: string; expires_in: number };
    appToken = { value: json.access_token, exp: Date.now() + json.expires_in * 1000 };
    return json.access_token;
  }

  async function helix(path: string): Promise<unknown> {
    const response = await fetch(`https://api.twitch.tv/helix${path}`, {
      headers: {
        Authorization: `Bearer ${await token()}`,
        "Client-Id": env.TWITCH_CLIENT_ID ?? "",
      },
    });
    if (!response.ok) throw new Error(`Twitch helix ${path} failed: ${response.status}`);
    return response.json();
  }

  return {
    platform: "TWITCH",
    configured: () => Boolean(env.TWITCH_CLIENT_ID && env.TWITCH_CLIENT_SECRET),
    async validateChannel(channelKey) {
      const json = (await helix(`/users?login=${encodeURIComponent(channelKey.replace(/^#/, ""))}`)) as {
        data: { id: string; display_name: string; login: string }[];
      };
      const user = json.data[0];
      if (!user) throw new Error("Twitch user not found");
      return {
        platform: "TWITCH",
        channelKey: user.login,
        externalId: user.id,
        displayName: user.display_name,
        url: `https://twitch.tv/${user.login}`,
      };
    },
    async getLiveStatus(externalId) {
      const json = (await helix(`/streams?user_id=${encodeURIComponent(externalId)}`)) as {
        data: { title: string; game_name: string; viewer_count: number; started_at: string; user_login: string; thumbnail_url: string }[];
      };
      const stream = json.data[0];
      if (!stream) return { live: false };
      return {
        live: true,
        title: stream.title,
        game: stream.game_name,
        viewerCount: stream.viewer_count,
        startedAt: stream.started_at,
        url: `https://twitch.tv/${stream.user_login}`,
        thumbnailUrl: stream.thumbnail_url.replace("{width}", "1280").replace("{height}", "720"),
      };
    },
  };
}

function youtubeProvider(env: StreamProviderEnv): StreamProvider {
  return {
    platform: "YOUTUBE",
    configured: () => Boolean(env.YOUTUBE_API_KEY),
    async validateChannel(channelKey) {
      if (!env.YOUTUBE_API_KEY) throw new NotConfiguredError("YouTube");
      const key = env.YOUTUBE_API_KEY;
      const cleaned = channelKey.replace(/^@/, "");
      const byId = channelKey.startsWith("UC")
        ? await fetch(
            `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${encodeURIComponent(channelKey)}&key=${key}`,
          )
        : await fetch(
            `https://www.googleapis.com/youtube/v3/channels?part=snippet&forHandle=${encodeURIComponent(cleaned)}&key=${key}`,
          );
      if (!byId.ok) throw new Error(`YouTube channel lookup failed: ${byId.status}`);
      const json = (await byId.json()) as { items?: { id: string; snippet: { title: string } }[] };
      const item = json.items?.[0];
      if (!item) throw new Error("YouTube channel not found");
      return {
        platform: "YOUTUBE",
        channelKey: item.id,
        externalId: item.id,
        displayName: item.snippet.title,
        url: `https://www.youtube.com/channel/${item.id}`,
      };
    },
    async getLiveStatus(externalId) {
      if (!env.YOUTUBE_API_KEY) throw new NotConfiguredError("YouTube");
      // Der RSS-Feed kostet kein API-Kontingent und listet auch laufende/geplante Streams.
      // search?eventType=live kostete 100 Einheiten pro Aufruf, videos.list kostet nur 1.
      const videoIds = await fetchYoutubeFeedVideoIds(externalId);
      if (!videoIds.length) return { live: false };
      const url =
        `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoIds.join(",")}` +
        `&key=${env.YOUTUBE_API_KEY}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`YouTube videos lookup failed: ${response.status}`);
      const json = (await response.json()) as {
        items?: { id: string; snippet: { title: string; liveBroadcastContent?: string } }[];
      };
      const item = json.items?.find((video) => video.snippet.liveBroadcastContent === "live");
      if (!item) return { live: false };
      return {
        live: true,
        title: item.snippet.title,
        url: `https://www.youtube.com/watch?v=${item.id}`,
      };
    },
  };
}

/** Liefert die IDs der neuesten Videos eines Kanals aus dem öffentlichen RSS-Feed (max. 10). */
export async function fetchYoutubeFeedVideoIds(channelId: string, limit = 10): Promise<string[]> {
  const response = await fetch(
    `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`,
  );
  if (!response.ok) throw new Error(`YouTube feed failed: ${response.status}`);
  return parseYoutubeFeedVideoIds(await response.text(), limit);
}

export function parseYoutubeFeedVideoIds(xml: string, limit = 10): string[] {
  const ids: string[] = [];
  for (const match of xml.matchAll(/<yt:videoId>([\w-]{6,20})<\/yt:videoId>/g)) {
    if (match[1] && !ids.includes(match[1])) ids.push(match[1]);
    if (ids.length >= limit) break;
  }
  return ids;
}

function kickProvider(env: StreamProviderEnv): StreamProvider {
  let appToken: { value: string; exp: number } | null = null;

  async function token(): Promise<string> {
    if (!env.KICK_CLIENT_ID || !env.KICK_CLIENT_SECRET) throw new NotConfiguredError("Kick");
    if (appToken && appToken.exp > Date.now() + 30_000) return appToken.value;
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: env.KICK_CLIENT_ID,
      client_secret: env.KICK_CLIENT_SECRET,
    });
    const response = await fetch("https://id.kick.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!response.ok) throw new Error(`Kick token failed: ${response.status}`);
    const json = (await response.json()) as { access_token: string; expires_in?: number };
    appToken = { value: json.access_token, exp: Date.now() + (json.expires_in ?? 3600) * 1000 };
    return json.access_token;
  }

  return {
    platform: "KICK",
    configured: () => Boolean(env.KICK_CLIENT_ID && env.KICK_CLIENT_SECRET),
    async validateChannel(channelKey) {
      const slug = channelKey.replace(/^@/, "");
      const response = await fetch(`https://api.kick.com/public/v1/channels?slug=${encodeURIComponent(slug)}`, {
        headers: { Authorization: `Bearer ${await token()}`, Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`Kick channel lookup failed: ${response.status}`);
      const json = (await response.json()) as {
        data?: { broadcaster_user_id?: number; slug?: string; channel_slug?: string }[];
      };
      const channel = json.data?.[0];
      if (!channel) throw new Error("Kick channel not found");
      const id = String(channel.broadcaster_user_id ?? slug);
      return {
        platform: "KICK",
        channelKey: slug,
        externalId: id,
        displayName: channel.slug ?? slug,
        url: `https://kick.com/${slug}`,
      };
    },
    async getLiveStatus(externalId) {
      const response = await fetch(
        `https://api.kick.com/public/v1/livestreams?broadcaster_user_id=${encodeURIComponent(externalId)}`,
        { headers: { Authorization: `Bearer ${await token()}`, Accept: "application/json" } },
      );
      if (!response.ok) throw new Error(`Kick livestream lookup failed: ${response.status}`);
      const json = (await response.json()) as {
        data?: { title?: string; viewer_count?: number; started_at?: string; thumbnail?: string }[];
      };
      const live = json.data?.[0];
      if (!live) return { live: false };
      return {
        live: true,
        title: live.title,
        viewerCount: live.viewer_count,
        startedAt: live.started_at,
        thumbnailUrl: live.thumbnail,
      };
    },
  };
}

export { type StreamChannelInfo, type LiveStreamInfo };
