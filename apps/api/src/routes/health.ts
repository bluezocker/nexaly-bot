import type { FastifyInstance } from "fastify";
import type { AppDeps } from "../app.js";

export async function registerHealthRoutes(app: FastifyInstance, deps: AppDeps): Promise<void> {
  app.get("/v1/health", async () => ({
    ok: true,
    service: "nexaly-api",
    ts: new Date().toISOString(),
  }));

  app.get("/v1/ready", async (_request, reply) => {
    try {
      await deps.prisma.$queryRaw`SELECT 1`;
      const pong = await deps.redis.ping();
      if (pong !== "PONG") throw new Error("redis not ready");
      return { ok: true, database: true, redis: true };
    } catch {
      return reply.status(503).send({
        error: { code: "INTERNAL", message: "Dependencies unavailable", details: [] },
      });
    }
  });
}
