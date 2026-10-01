import { createLogger } from "@nexaly/logger";
import Redis from "ioredis";
import { pollSocial } from "./social-poller.js";
import { pollStreams } from "./stream-poller.js";
import { processWelcomeJobs } from "./welcome-worker.js";

const log = createLogger("worker", process.env.LOG_LEVEL ?? "info");

async function main(): Promise<void> {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is required");
  const redis = new Redis(url);
  const jobs = new Redis(url);
  log.info("Nexaly worker online (welcome cards)");

  const tick = async () => {
    await redis.set("worker:heartbeat", new Date().toISOString(), "EX", 30);
  };
  await tick();
  const timer = setInterval(() => void tick(), 15_000);

  void processWelcomeJobs(jobs, process.env.DISCORD_TOKEN);
  const poll = setInterval(() => {
    void pollStreams(redis).catch((error) => log.error(error, "stream poll"));
  }, 60_000);
  const social = setInterval(() => {
    void pollSocial().catch((error) => log.error(error, "social poll"));
  }, 5 * 60_000);
  void pollStreams(redis).catch((error) => log.error(error, "stream poll"));
  void pollSocial().catch((error) => log.error(error, "social poll"));

  const shutdown = async () => {
    clearInterval(timer);
    clearInterval(poll);
    clearInterval(social);
    await jobs.quit();
    await redis.quit();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown());
  process.on("SIGINT", () => void shutdown());
}

main().catch((error) => {
  log.error(error, "Worker failed to start");
  process.exit(1);
});
