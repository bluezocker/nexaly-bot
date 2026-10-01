import { randomBytes } from "node:crypto";
import { OAUTH_STATE_COOKIE, SESSION_COOKIE } from "@nexaly/config";
import { unauthorized } from "@nexaly/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppDeps } from "../app.js";
import { requireUser } from "../app.js";
import { oauthStateKey } from "../redis.js";
import { buildAuthorizeUrl, exchangeCode, fetchCurrentUser, warmUserGuildsCache } from "../services/discord-oauth.js";
import { destroySession, persistSession } from "../services/sessions.js";

const callbackQuery = z.object({ code: z.string().min(1), state: z.string().min(1) });

function cookieBase(env: AppDeps["env"]) {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.NODE_ENV === "production",
  };
}

export async function registerAuthRoutes(app: FastifyInstance, deps: AppDeps): Promise<void> {
  app.get("/v1/auth/discord", async (_request, reply) => {
    const state = randomBytes(16).toString("hex");
    await deps.redis.set(oauthStateKey(state), "1", "EX", 600);
    const url = buildAuthorizeUrl({
      clientId: deps.env.DISCORD_CLIENT_ID,
      redirectUri: deps.env.DISCORD_REDIRECT_URI,
      state,
    });
    return reply
      .setCookie(OAUTH_STATE_COOKIE, state, { ...cookieBase(deps.env), maxAge: 600 })
      .send({ url });
  });

  app.get("/v1/auth/discord/callback", async (request, reply) => {
    const parsed = callbackQuery.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: "VALIDATION", message: "Missing OAuth code or state", details: [] },
      });
    }
    const cookieState = request.cookies[OAUTH_STATE_COOKIE];
    if (!cookieState || cookieState !== parsed.data.state) {
      throw unauthorized("OAuth state mismatch");
    }
    const stored = await deps.redis.get(oauthStateKey(parsed.data.state));
    if (!stored) throw unauthorized("Invalid or expired OAuth state");
    await deps.redis.del(oauthStateKey(parsed.data.state));

    const tokens = await exchangeCode({
      clientId: deps.env.DISCORD_CLIENT_ID,
      clientSecret: deps.env.DISCORD_CLIENT_SECRET,
      redirectUri: deps.env.DISCORD_REDIRECT_URI,
      code: parsed.data.code,
    });
    const profile = await fetchCurrentUser(tokens.access_token);

    await deps.prisma.user.upsert({
      where: { id: profile.id },
      create: {
        id: profile.id,
        username: profile.username,
        globalName: profile.global_name,
        avatar: profile.avatar,
        lastLoginAt: new Date(),
      },
      update: {
        username: profile.username,
        globalName: profile.global_name,
        avatar: profile.avatar,
        lastLoginAt: new Date(),
      },
    });

    const session = await persistSession({
      prisma: deps.prisma,
      redis: deps.redis,
      userId: profile.id,
      accessToken: tokens.access_token,
      expiresInSec: tokens.expires_in,
    });
    await warmUserGuildsCache(deps.redis, profile.id, tokens.access_token);

    return reply
      .clearCookie(OAUTH_STATE_COOKIE, { path: "/" })
      .send({ ok: true, sessionId: session.id });
  });

  app.post("/v1/auth/logout", async (request, reply) => {
    if (request.sessionId) {
      await destroySession({ prisma: deps.prisma, redis: deps.redis, sessionId: request.sessionId });
    }
    return reply.clearCookie(SESSION_COOKIE, { path: "/" }).send({ ok: true });
  });

  app.get("/v1/me", async (request) => {
    const { userId } = await requireUser(request);
    const user = await deps.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw unauthorized();
    return {
      id: user.id,
      username: user.username,
      globalName: user.globalName,
      avatar: user.avatar,
      avatarUrl: user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
        : null,
    };
  });
}
