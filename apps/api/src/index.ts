import { loadApiEnv } from "@nexaly/config";
import { prisma } from "@nexaly/database";
import { createLogger } from "@nexaly/logger";
import { buildApp } from "./app.js";
import { createRedis } from "./redis.js";

const log = createLogger("api", process.env.LOG_LEVEL ?? "info");

async function main(): Promise<void> {
  const env = loadApiEnv();
  const redis = createRedis(env.REDIS_URL);
  const app = await buildApp({ env, prisma, redis });

  const shutdown = async (signal: string) => {
    log.info({ signal }, "shutting down");
    await app.close();
    await redis.quit();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
  await app.listen({ port: env.API_PORT, host: "0.0.0.0" });
  log.info({ port: env.API_PORT }, "Nexaly API listening");
}

main().catch((error) => {
  log.error(error, "API failed to start");
  process.exit(1);
});
