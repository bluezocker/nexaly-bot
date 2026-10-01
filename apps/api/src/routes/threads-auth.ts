import { randomBytes } from "node:crypto";
import { fetchThreadsProfile, validationError, unauthorized } from "@nexaly/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppDeps } from "../app.js";
import { requireDiscordToken, requireUser } from "../app.js";
import { fetchCurrentUserGuilds } from "../services/discord-oauth.js";
import { ensureGuildAccess } from "../services/guilds.js";

const startQuery = z.object({
  guildId: z.string().regex(/^\d{17,20}$/),
  channelId: z.string().regex(/^\d{17,20}$/),
});

function threadsRedirect(env: AppDeps["env"]): string {
  return env.THREADS_REDIRECT_URI ?? `${env.PUBLIC_WEB_URL}/api/auth/threads/callback`;
}

export async function registerThreadsAuthRoutes(app: FastifyInstance, deps: AppDeps): Promise<void> {
  app.get("/v1/auth/threads", async (request) => {
    const { userId, sessionId } = await requireUser(request);
    const parsed = startQuery.safeParse(request.query);
    if (!parsed.success) throw validationError("Kanal fehlt");
    if (!deps.env.THREADS_APP_ID || !deps.env.THREADS_APP_SECRET) {
      throw validationError("Threads ist auf dem Server nicht konfiguriert");
    }
    const accessToken = await requireDiscordToken(deps.redis, sessionId);
    const oauthGuilds = await fetchCurrentUserGuilds(deps.redis, userId, accessToken);
    await ensureGuildAccess({
      prisma: deps.prisma,
      userId,
      guildId: parsed.data.guildId,
      oauthGuilds,
    });
    const state = randomBytes(16).toString("hex");
    await deps.redis.set(
      `oauth:threads:${state}`,
      JSON.stringify({ guildId: parsed.data.guildId, channelId: parsed.data.channelId, userId }),
      "EX",
      600,
    );
    const url = new URL("https://threads.com/oauth/authorize");
    url.searchParams.set("client_id", deps.env.THREADS_APP_ID);
    url.searchParams.set("redirect_uri", threadsRedirect(deps.env));
    url.searchParams.set("scope", "threads_basic");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", state);
    return { url: url.toString(), state };
  });

  app.get("/v1/auth/threads/callback", async (request) => {
    const query = z
      .object({ code: z.string().min(1), state: z.string().min(1) })
      .safeParse(request.query);
    if (!query.success) throw unauthorized("Threads-Anmeldung abgebrochen");
    const raw = await deps.redis.get(`oauth:threads:${query.data.state}`);
    if (!raw) throw unauthorized("Threads-Anmeldung abgelaufen");
    await deps.redis.del(`oauth:threads:${query.data.state}`);
    const pending = z
      .object({
        guildId: z.string().regex(/^\d{17,20}$/),
        channelId: z.string().regex(/^\d{17,20}$/),
        userId: z.string().min(1),
      })
      .parse(JSON.parse(raw));
    if (!deps.env.THREADS_APP_ID || !deps.env.THREADS_APP_SECRET) {
      throw validationError("Threads ist auf dem Server nicht konfiguriert");
    }

    const code = query.data.code.replace(/#_$/, "");
    const tokenRes = await fetch("https://graph.threads.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: deps.env.THREADS_APP_ID,
        client_secret: deps.env.THREADS_APP_SECRET,
        grant_type: "authorization_code",
        redirect_uri: threadsRedirect(deps.env),
        code,
      }),
    });
    if (!tokenRes.ok) throw validationError("Threads hat den Code abgelehnt");
    const shortLived = (await tokenRes.json()) as { access_token?: string };
    if (!shortLived.access_token) throw validationError("Threads hat kein Token geliefert");

    const longParams = new URLSearchParams({
      grant_type: "th_exchange_token",
      client_secret: deps.env.THREADS_APP_SECRET,
      access_token: shortLived.access_token,
    });
    const longRes = await fetch(`https://graph.threads.com/access_token?${longParams}`);
    if (!longRes.ok) throw validationError("Threads-Token konnte nicht verlängert werden");
    const longLived = (await longRes.json()) as { access_token?: string; expires_in?: number };
    if (!longLived.access_token || !longLived.expires_in) {
      throw validationError("Threads-Token konnte nicht verlängert werden");
    }

    const profile = await fetchThreadsProfile(longLived.access_token);
    const expiresAt = new Date(Date.now() + longLived.expires_in * 1000);
    await deps.prisma.socialSubscription.upsert({
      where: {
        guildId_platform_accountKey: {
          guildId: pending.guildId,
          platform: "THREADS",
          accountKey: profile.username.toLowerCase(),
        },
      },
      create: {
        guildId: pending.guildId,
        platform: "THREADS",
        accountKey: profile.username.toLowerCase(),
        externalId: profile.id,
        displayName: profile.username,
        announceChannelId: pending.channelId,
        accessToken: longLived.access_token,
        tokenExpiresAt: expiresAt,
      },
      update: {
        externalId: profile.id,
        displayName: profile.username,
        announceChannelId: pending.channelId,
        accessToken: longLived.access_token,
        tokenExpiresAt: expiresAt,
        enabled: true,
        lastError: null,
      },
    });
    await deps.prisma.guildModule.upsert({
      where: { guildId_key: { guildId: pending.guildId, key: "social" } },
      create: { guildId: pending.guildId, key: "social", enabled: true },
      update: { enabled: true },
    });
    return { ok: true, guildId: pending.guildId };
  });
}
