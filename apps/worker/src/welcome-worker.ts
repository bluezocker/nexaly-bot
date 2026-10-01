import type Redis from "ioredis";
import { WELCOME_QUEUE, welcomeResultKey, type WelcomeCardJob } from "@nexaly/shared";
import { createLogger } from "@nexaly/logger";
import { renderWelcomeCard } from "./render-card.js";
import { sendWelcomeImage } from "./discord-send.js";

const log = createLogger("worker-welcome");

export async function processWelcomeJobs(redis: Redis, token: string | undefined): Promise<void> {
  while (true) {
    const popped = await redis.brpop(WELCOME_QUEUE, 5);
    if (!popped) continue;
    const raw = popped[1];
    if (!raw) continue;
    let job: WelcomeCardJob;
    try {
      job = JSON.parse(raw) as WelcomeCardJob;
    } catch {
      continue;
    }
    try {
      const png = await renderWelcomeCard(job);
      if (job.kind === "preview") {
        await redis.lpush(welcomeResultKey(job.jobId), png.toString("base64"));
        await redis.expire(welcomeResultKey(job.jobId), 30);
      } else if (job.kind === "send" && job.channelId && token) {
        await sendWelcomeImage({
          token,
          channelId: job.channelId,
          caption: job.caption ?? "",
          png,
        });
        await redis.lpush(welcomeResultKey(job.jobId), "ok");
        await redis.expire(welcomeResultKey(job.jobId), 30);
      }
    } catch (error) {
      log.error(error, "welcome job failed");
      await redis.lpush(welcomeResultKey(job.jobId), "error");
      await redis.expire(welcomeResultKey(job.jobId), 30);
    }
  }
}
