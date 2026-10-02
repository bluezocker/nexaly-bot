import { loadBotEnv } from "@nexaly/config";
import { prisma } from "@nexaly/database";
import { createLogger } from "@nexaly/logger";
import { Status } from "discord.js";
import Redis from "ioredis";
import { createBotClient } from "./client.js";
import { bindCommandHandler, registerCommands } from "./commands/register.js";
import { registerLogsModule } from "./modules/logs/index.js";
import { registerModerationModule } from "./modules/moderation/index.js";
import { registerWelcomeModule } from "./modules/welcome/index.js";
import { registerLevelsModule } from "./modules/levels/index.js";
import { registerReactionRoles } from "./modules/reaction-roles.js";
import { registerTickets } from "./modules/tickets.js";
import { bindGuildSync, syncExistingGuilds } from "./sync-guilds.js";

const log = createLogger("bot", process.env.LOG_LEVEL ?? "info");

async function main(): Promise<void> {
  const env = loadBotEnv();
  const redis = new Redis(env.REDIS_URL);
  const subscriber = new Redis(env.REDIS_URL);
  const client = createBotClient();
  bindCommandHandler(client);
  bindGuildSync(client);
  registerLogsModule(client, subscriber);
  registerModerationModule(client, redis, subscriber);
  registerWelcomeModule(client, redis, subscriber);
  registerLevelsModule(client, redis, subscriber);
  registerReactionRoles(client);
  registerTickets(client, redis);

  client.once("ready", async (readyClient) => {
    log.info({ user: readyClient.user.tag, guilds: readyClient.guilds.cache.size }, "Nexaly online");
    await syncExistingGuilds(readyClient);
    if (env.DISCORD_CLIENT_ID) {
      await registerCommands({
        token: env.DISCORD_TOKEN,
        clientId: env.DISCORD_CLIENT_ID,
        devGuildId: env.DISCORD_DEV_GUILD_ID,
      });
      log.info("Slash commands registered");
    }
    // Herzschlag nur schreiben, solange der Bot wirklich mit dem Discord-Gateway verbunden ist.
    // Läuft der Container, aber die Verbindung ist weg, läuft der Schlüssel nach 30 s ab
    // und /api/status/bot meldet 503 (Uptime Kuma schlägt Alarm).
    const beat = async () => {
      if (!client.isReady() || client.ws.status !== Status.Ready) return;
      await redis.set(
        "bot:heartbeat:0",
        JSON.stringify({ ts: new Date().toISOString(), ping: client.ws.ping, guilds: client.guilds.cache.size }),
        "EX",
        30,
      );
    };
    await beat();
    setInterval(() => void beat().catch((error) => log.warn({ err: error }, "heartbeat failed")), 15_000);
  });

  const shutdown = async (signal: string) => {
    log.info({ signal }, "shutting down bot");
    client.destroy();
    await subscriber.quit();
    await redis.quit();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
  await client.login(env.DISCORD_TOKEN);
}

main().catch((error) => {
  log.error(error, "Bot failed to start");
  process.exit(1);
});
