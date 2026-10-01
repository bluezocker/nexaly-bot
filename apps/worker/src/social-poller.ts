import { prisma } from "@nexaly/database";
import { createLogger } from "@nexaly/logger";
import { DISCORD_API_BASE, fetchThreadsPosts, fetchXPosts, refreshThreadsToken } from "@nexaly/shared";
import type { SocialPost } from "@nexaly/shared";
import type { SocialSubscription } from "@nexaly/database";

const log = createLogger("social-poller");

export async function pollSocial(): Promise<void> {
  const token = process.env.DISCORD_TOKEN;
  if (!token) return;
  const subs = await prisma.socialSubscription.findMany({ where: { enabled: true } });
  for (const sub of subs) {
    try {
      if (sub.platform === "X") await pollX(sub, token);
      else await pollThreads(sub, token);
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      const message =
        status === 401 || status === 403
          ? "API-Zugriff verweigert"
          : "Abruf fehlgeschlagen";
      log.error({ err: error, platform: sub.platform, account: sub.accountKey }, "social poll failed");
      await prisma.socialSubscription.update({
        where: { id: sub.id },
        data: { lastError: message },
      });
    }
  }
}

async function pollX(sub: SocialSubscription, discordToken: string): Promise<void> {
  const bearer = process.env.X_BEARER_TOKEN;
  if (!bearer) return;
  const posts = await fetchXPosts(bearer, sub.externalId, sub.lastPostId);
  if (!posts.length) return;
  if (!sub.lastPostId) {
    await markSeen(sub.id, posts[0]!.id);
    return;
  }
  await announce(sub, posts, discordToken, "X");
  await markSeen(sub.id, posts[0]!.id);
}

async function pollThreads(sub: SocialSubscription, discordToken: string): Promise<void> {
  if (!sub.accessToken) return;
  let token = sub.accessToken;
  const week = 7 * 24 * 3600 * 1000;
  if (sub.tokenExpiresAt && sub.tokenExpiresAt.getTime() - Date.now() < week) {
    if (sub.tokenExpiresAt.getTime() < Date.now()) {
      await prisma.socialSubscription.update({
        where: { id: sub.id },
        data: { enabled: false, lastError: "Threads-Anmeldung abgelaufen. Konto erneut verbinden." },
      });
      return;
    }
    const refreshed = await refreshThreadsToken(token);
    token = refreshed.accessToken;
    await prisma.socialSubscription.update({
      where: { id: sub.id },
      data: {
        accessToken: token,
        tokenExpiresAt: new Date(Date.now() + refreshed.expiresIn * 1000),
      },
    });
  }
  const posts = [...(await fetchThreadsPosts(token))].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (!posts.length) return;
  if (!sub.lastPostId) {
    await markSeen(sub.id, posts[0]!.id);
    return;
  }
  const index = posts.findIndex((post) => post.id === sub.lastPostId);
  if (index === -1) {
    await markSeen(sub.id, posts[0]!.id);
    return;
  }
  const newer = posts.slice(0, index);
  if (newer.length) await announce(sub, newer, discordToken, "Threads");
  await markSeen(sub.id, posts[0]!.id);
}

async function announce(
  sub: SocialSubscription,
  posts: SocialPost[],
  discordToken: string,
  label: string,
): Promise<void> {
  const ordered = [...posts].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const post of ordered) {
    const text = post.text.trim().slice(0, 500) || "Neuer Post";
    const response = await fetch(`${DISCORD_API_BASE}/channels/${sub.announceChannelId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${discordToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [{ title: `${label} · @${sub.accountKey}`, description: text, url: post.url, color: 0x7c5cff }],
      }),
    });
    if (!response.ok) throw Object.assign(new Error(`Discord ${response.status}`), { statusCode: response.status });
  }
}

async function markSeen(id: string, postId: string): Promise<void> {
  await prisma.socialSubscription.update({
    where: { id },
    data: { lastPostId: postId, lastError: null },
  });
}
