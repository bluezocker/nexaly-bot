import type { Client } from "discord.js";
import type Redis from "ioredis";
import { bindAutomod } from "./automod.js";
import { invalidateModerationConfig } from "./config.js";
import { bindRaidGuard } from "./raid.js";

export { moderationCommands } from "./commands.js";
export { invalidateModerationConfig } from "./config.js";

export function registerModerationModule(client: Client, redis: Redis, subscriber: Redis): void {
  bindAutomod(client, redis);
  bindRaidGuard(client, redis);

  subscriber.on("pmessage", (_pattern, channel, message) => {
    const match = /^guild:(.+):config$/.exec(channel);
    if (!match?.[1]) return;
    try {
      const parsed = JSON.parse(message) as { module?: string };
      if (!parsed.module || parsed.module === "moderation") {
        invalidateModerationConfig(match[1]);
      }
    } catch {
      invalidateModerationConfig(match[1]);
    }
  });
}
