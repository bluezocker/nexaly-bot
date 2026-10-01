import type { Client } from "discord.js";
import type Redis from "ioredis";
import { getLevelConfig, invalidateLevelConfig } from "./config.js";
import { grantMessageXp } from "./engine.js";

export { levelCommands } from "./commands.js";
export { invalidateLevelConfig } from "./config.js";

export function registerLevelsModule(client: Client, redis: Redis, subscriber: Redis): void {
  client.on("messageCreate", (message) => {
    void (async () => {
      if (!message.inGuild() || !message.member || message.author.bot) return;
      const config = await getLevelConfig(message.guild.id);
      if (!config?.enabled) return;
      await grantMessageXp({ redis, member: message.member, channelId: message.channelId, config });
    })().catch((error) => console.error("levels", error));
  });

  subscriber.on("pmessage", (_pattern, channel, message) => {
    const match = /^guild:(.+):config$/.exec(channel);
    if (!match?.[1]) return;
    try {
      const parsed = JSON.parse(message) as { module?: string };
      if (!parsed.module || parsed.module === "levels") invalidateLevelConfig(match[1]);
    } catch {
      invalidateLevelConfig(match[1]);
    }
  });
}
