import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import type { Env } from "@nexaly/config";
import { SESSION_COOKIE } from "@nexaly/config";
import type { PrismaClient } from "@nexaly/database";
import { AppError, unauthorized } from "@nexaly/shared";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import type Redis from "ioredis";
import { oauthTokenKey } from "./redis.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerChannelRoutes } from "./routes/channels.js";
import { registerGuildRoutes } from "./routes/guilds.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerPublicRoutes } from "./routes/public.js";
import { registerLogRoutes } from "./routes/logs.js";
import { registerModerationRoutes } from "./routes/moderation.js";
import { registerEmbedRoutes } from "./routes/embeds.js";
import { registerStreamRoutes } from "./routes/streams.js";
import { registerSocialRoutes } from "./routes/social.js";
import { registerThreadsAuthRoutes } from "./routes/threads-auth.js";
import { registerTicketRoutes } from "./routes/tickets.js";
import { registerWelcomeRoutes } from "./routes/welcome.js";
import { registerLevelRoutes } from "./routes/levels.js";
import { getActiveSession } from "./services/sessions.js";

export interface AppDeps {
  env: Env & {
    DISCORD_CLIENT_ID: string;
    DISCORD_CLIENT_SECRET: string;
    DISCORD_REDIRECT_URI: string;
  };
  prisma: PrismaClient;
  redis: Redis;
}

declare module "fastify" {
  interface FastifyRequest {
    sessionId: string | null;
    userId: string | null;
  }
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: true, trustProxy: true });
  await app.register(helmet, { global: true });
  await app.register(cors, { origin: deps.env.PUBLIC_WEB_URL, credentials: true });
  await app.register(cookie);
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute", redis: deps.redis });

  app.decorateRequest("sessionId", null);
  app.decorateRequest("userId", null);

  app.addHook("onRequest", async (request) => {
    const token = request.cookies[SESSION_COOKIE];
    request.sessionId = token ?? null;
    request.userId = null;
    if (!token) return;
    const session = await getActiveSession(deps.prisma, token);
    request.userId = session?.userId ?? null;
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message, details: error.details },
      });
    }
    request.log?.error?.(error);
    console.error("[api]", request.method, request.url, error);
    const status =
      typeof error === "object" && error && "statusCode" in error
        ? Number((error as { statusCode?: number }).statusCode) || 500
        : 500;
    const raw = error instanceof Error ? error.message : "Internal server error";
    return reply.status(status).send({
      error: {
        code: status === 429 ? "RATE_LIMITED" : "INTERNAL",
        message: status >= 500 ? "Internal server error" : status === 429 ? "Too many requests" : raw,
        details: [],
      },
    });
  });

  await registerHealthRoutes(app, deps);
  await registerPublicRoutes(app, deps);
  await registerAuthRoutes(app, deps);
  await registerGuildRoutes(app, deps);
  await registerLogRoutes(app, deps);
  await registerModerationRoutes(app, deps);
  await registerWelcomeRoutes(app, deps);
  await registerLevelRoutes(app, deps);
  await registerEmbedRoutes(app, deps);
  await registerStreamRoutes(app, deps);
  await registerSocialRoutes(app, deps);
  await registerThreadsAuthRoutes(app, deps);
  await registerTicketRoutes(app, deps);
  await registerChannelRoutes(app, deps);
  return app;
}

export async function requireUser(request: FastifyRequest) {
  if (!request.userId || !request.sessionId) throw unauthorized();
  return { userId: request.userId, sessionId: request.sessionId };
}

export async function requireDiscordToken(redis: Redis, sessionId: string): Promise<string> {
  const token = await redis.get(oauthTokenKey(sessionId));
  if (!token) throw unauthorized("Discord session expired. Please sign in again.");
  return token;
}
