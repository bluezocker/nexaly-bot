import type { Client } from "discord.js";
import type Redis from "ioredis";
import { configChannel } from "@nexaly/shared";
import { invalidateLogConfig } from "./config.js";
import { bindLogEvents } from "./events.js";
import { pruneExpiredLogs } from "./emit.js";

export { emitBotModerationLog } from "./events.js";
export { invalidateLogConfig } from "./config.js";

export function registerLogsModule(client: Client, subscriber: Redis): void {
  bindLogEvents(client);

  subscriber.on("pmessage", (_pattern, channel, message) => {
    const match = /^guild:(.+):config$/.exec(channel);
    if (!match?.[1]) return;
    try {
      const parsed = JSON.parse(message) as { module?: string };
      if (!parsed.module || parsed.module === "logs") {
        invalidateLogConfig(match[1]);
      }
    } catch {
      invalidateLogConfig(match[1]);
    }
  });

  void subscriber.psubscribe("guild:*:config");

  const hour = 60 * 60 * 1000;
  setInterval(() => {
    void pruneExpiredLogs();
  }, hour);
}

export { configChannel };
