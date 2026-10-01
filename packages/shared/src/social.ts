import { z } from "zod";

export const SOCIAL_PLATFORMS = ["X", "THREADS"] as const;
export type SocialPlatformName = (typeof SOCIAL_PLATFORMS)[number];

const snowflake = z.string().regex(/^\d{17,20}$/);

export function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@/, "").toLowerCase();
}

export const socialSubscriptionSchema = z
  .object({
    platform: z.literal("X"),
    handle: z.preprocess(
      (value) => (typeof value === "string" ? normalizeHandle(value) : value),
      z.string().regex(/^[a-z0-9_]{1,15}$/),
    ),
    announceChannelId: snowflake,
  })
  .strict();

export type SocialPost = {
  id: string;
  text: string;
  url: string;
  createdAt: string;
};

async function asJson(response: Response): Promise<unknown> {
  if (!response.ok) {
    throw Object.assign(new Error(`HTTP ${response.status}`), { statusCode: response.status });
  }
  return response.json() as Promise<unknown>;
}

export async function lookupXUser(
  bearer: string,
  username: string,
): Promise<{ id: string; username: string; name: string }> {
  const response = await fetch(`https://api.x.com/2/users/by/username/${encodeURIComponent(username)}`, {
    headers: { Authorization: `Bearer ${bearer}` },
  });
  const body = (await asJson(response)) as { data?: { id: string; username: string; name: string } };
  if (!body.data?.id) throw Object.assign(new Error("X user not found"), { statusCode: 404 });
  return body.data;
}

export async function fetchXPosts(bearer: string, userId: string, sinceId?: string | null): Promise<SocialPost[]> {
  const params = new URLSearchParams({
    max_results: "5",
    exclude: "replies,retweets",
    "tweet.fields": "created_at",
  });
  if (sinceId) params.set("since_id", sinceId);
  const response = await fetch(`https://api.x.com/2/users/${userId}/tweets?${params}`, {
    headers: { Authorization: `Bearer ${bearer}` },
  });
  const body = (await asJson(response)) as {
    data?: { id: string; text?: string; created_at?: string }[];
    includes?: { users?: { username: string }[] };
  };
  return (body.data ?? []).map((post) => ({
    id: post.id,
    text: post.text ?? "",
    url: `https://x.com/i/status/${post.id}`,
    createdAt: post.created_at ?? new Date().toISOString(),
  }));
}

export async function fetchThreadsProfile(token: string): Promise<{ id: string; username: string }> {
  const response = await fetch("https://graph.threads.com/v1.0/me?fields=id,username", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await asJson(response)) as { id?: string; username?: string };
  if (!body.id || !body.username) throw Object.assign(new Error("Threads profile missing"), { statusCode: 502 });
  return { id: body.id, username: body.username };
}

export async function fetchThreadsPosts(token: string): Promise<SocialPost[]> {
  const params = new URLSearchParams({
    fields: "id,text,permalink,timestamp,username",
    limit: "5",
  });
  const response = await fetch(`https://graph.threads.com/v1.0/me/threads?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await asJson(response)) as {
    data?: { id: string; text?: string; permalink?: string; timestamp?: string; username?: string }[];
  };
  return (body.data ?? []).map((post) => ({
    id: post.id,
    text: post.text ?? "",
    url: post.permalink ?? `https://www.threads.com/@${post.username ?? "unknown"}`,
    createdAt: post.timestamp ?? new Date().toISOString(),
  }));
}

export async function refreshThreadsToken(token: string): Promise<{ accessToken: string; expiresIn: number }> {
  const params = new URLSearchParams({ grant_type: "th_refresh_token", access_token: token });
  const response = await fetch(`https://graph.threads.com/refresh_access_token?${params}`);
  const body = (await asJson(response)) as { access_token?: string; expires_in?: number };
  if (!body.access_token || !body.expires_in) {
    throw Object.assign(new Error("Threads refresh failed"), { statusCode: 502 });
  }
  return { accessToken: body.access_token, expiresIn: body.expires_in };
}
