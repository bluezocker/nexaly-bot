import { MODULE_KEYS } from "@nexaly/shared";
import { prisma } from "@nexaly/database";
import { createLogger } from "@nexaly/logger";
import type { Client, Guild } from "discord.js";

const log = createLogger("guild-sync");

export async function persistGuild(guild: Guild): Promise<void> {
  const existing = await prisma.guild.findUnique({
    where: { id: guild.id },
    select: { botJoinedAt: true },
  });
  await prisma.guild.upsert({
    where: { id: guild.id },
    create: {
      id: guild.id,
      name: guild.name,
      icon: guild.icon,
      ownerId: guild.ownerId,
      memberCount: guild.memberCount,
      botJoinedAt: new Date(),
      settings: { create: {} },
      modules: { create: MODULE_KEYS.map((key) => ({ key, enabled: false })) },
    },
    update: {
      name: guild.name,
      icon: guild.icon,
      ownerId: guild.ownerId,
      memberCount: guild.memberCount,
      botJoinedAt: existing?.botJoinedAt ?? new Date(),
    },
  });
}

export function bindGuildSync(client: Client): void {
  client.on("guildCreate", (guild) => void persistGuild(guild));
  client.on("guildUpdate", (_prev, next) => void persistGuild(next));
  client.on("guildDelete", (guild) => {
    void prisma.guild.updateMany({ where: { id: guild.id }, data: { botJoinedAt: null } });
  });
}

export async function syncExistingGuilds(client: Client): Promise<void> {
  const guilds = [...client.guilds.cache.values()];
  log.info({ count: guilds.length }, "syncing installed guilds");
  for (const guild of guilds) {
    try {
      await persistGuild(guild);
    } catch (error) {
      log.error({ err: error, guildId: guild.id }, "guild sync failed");
    }
  }
}