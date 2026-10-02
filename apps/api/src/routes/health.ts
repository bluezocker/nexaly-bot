import type { FastifyInstance } from "fastify";
import type { AppDeps } from "../app.js";

export async function registerHealthRoutes(app: FastifyInstance, deps: AppDeps): Promise<void> {
  app.get("/v1/health", async () => ({
    ok: true,
    service: "nexaly-api",
    ts: new Date().toISOString(),
  }));

  // Für Uptime Kuma: prüft, ob Bot (mit Discord verbunden) und Worker einen frischen Herzschlag haben.
  const heartbeat = async (key: string) => {
    const raw = await deps.redis.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return { ts: raw }; // älteres Format: nur Zeitstempel
    }
  };

  app.get("/v1/status/:component", async (request, reply) => {
    const { component } = request.params as { component: string };
    const key = component === "bot" ? "bot:heartbeat:0" : component === "worker" ? "worker:heartbeat" : null;
    if (!key) return reply.status(404).send({ ok: false, error: "unknown component" });
    const beat = await heartbeat(key);
    return reply.status(beat ? 200 : 503).send({ ok: Boolean(beat), component, heartbeat: beat });
  });

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
