import {
  DEFAULT_BOT_PERMISSIONS,
  DISCORD_API_BASE,
  DISCORD_OAUTH_AUTHORIZE,
  DISCORD_OAUTH_TOKEN,
} from "@nexaly/shared";
import type Redis from "ioredis";

export interface DiscordUser {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
}

export interface DiscordOAuthGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

const guildInflight = new Map<string, Promise<DiscordOAuthGuild[]>>();

export function buildAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    response_type: "code",
    redirect_uri: input.redirectUri,
    scope: "identify guilds",
    state: input.state,
    prompt: "consent",
  });
  return `${DISCORD_OAUTH_AUTHORIZE}?${params.toString()}`;
}

export function buildBotInviteUrl(clientId: string, guildId?: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    permissions: DEFAULT_BOT_PERMISSIONS,
    scope: "bot applications.commands",
  });
  if (guildId) {
    params.set("guild_id", guildId);
    params.set("disable_guild_select", "true");
  }
  return `${DISCORD_OAUTH_AUTHORIZE}?${params.toString()}`;
}

export async function exchangeCode(input: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: input.clientId,
    client_secret: input.clientSecret,
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri,
  });
  const response = await fetch(DISCORD_OAUTH_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    throw new Error(`Discord token exchange failed: ${response.status} ${await response.text()}`);
  }
  return (await response.json()) as TokenResponse;
}

async function discordGet<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${DISCORD_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw Object.assign(new Error(`Discord API ${path} failed: ${response.status}`), {
      statusCode: response.status,
    });
  }
  return (await response.json()) as T;
}

export const fetchCurrentUser = (token: string) => discordGet<DiscordUser>("/users/@me", token);

function guildCacheKey(userId: string) {
  return `oauth:guilds:${userId}`;
}

export async function fetchCurrentUserGuilds(
  redis: Redis,
  userId: string,
  accessToken: string,
): Promise<DiscordOAuthGuild[]> {
  const key = guildCacheKey(userId);
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached) as DiscordOAuthGuild[];

  const pending = guildInflight.get(userId);
  if (pending) return pending;

  const job = (async () => {
    try {
      const guilds = await discordGet<DiscordOAuthGuild[]>("/users/@me/guilds", accessToken);
      const payload = JSON.stringify(guilds);
      await redis.set(key, payload, "EX", 120);
      await redis.set(`${key}:stale`, payload, "EX", 3600);
      return guilds;
    } catch (error) {
      const stale = await redis.get(`${key}:stale`);
      if (stale) return JSON.parse(stale) as DiscordOAuthGuild[];
      throw error;
    } finally {
      guildInflight.delete(userId);
    }
  })();

  guildInflight.set(userId, job);
  return job;
}

export async function warmUserGuildsCache(
  redis: Redis,
  userId: string,
  accessToken: string,
): Promise<void> {
  try {
    await fetchCurrentUserGuilds(redis, userId, accessToken);
  } catch {
    /* login still succeeds if Discord guilds are rate-limited */
  }
}
