import { prisma } from "@nexaly/database";
import { createLogger } from "@nexaly/logger";
import type { Client, Guild } from "discord.js";
import { memberProfile } from "./engine.js";

const log = createLogger("levels-backfill");
const MAX_PER_GUILD = 300;

/**
 * Trägt Name und Avatar für XP-Einträge nach, die noch keine haben (Einträge von vor
 * der öffentlichen Rangliste). Wer den Server verlassen hat, bleibt ohne Namen und
 * erscheint nicht in der Rangliste.
 */
export async function backfillGuildLevelProfiles(guild: Guild): Promise<number> {
  const rows: { userId: string }[] = await prisma.memberLevel.findMany({
    where: { guildId: guild.id, displayName: null, xp: { gt: 0 } },
    orderBy: { xp: "desc" },
    take: MAX_PER_GUILD,
    select: { userId: true },
  });
  let updated = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const ids = rows.slice(i, i + 100).map((row) => row.userId);
    // Ein Gateway-Aufruf für bis zu 100 Mitglieder
    const members = await guild.members.fetch({ user: ids });
    for (const member of members.values()) {
      await prisma.memberLevel.update({
        where: { guildId_userId: { guildId: guild.id, userId: member.id } },
        data: memberProfile(member),
      });
      updated += 1;
    }
  }
  return updated;
}

export async function backfillLevelProfiles(client: Client): Promise<void> {
  for (const guild of client.guilds.cache.values()) {
    try {
      const updated = await backfillGuildLevelProfiles(guild);
      if (updated) log.info({ guildId: guild.id, updated }, "level profiles backfilled");
    } catch (error) {
      log.warn({ err: error, guildId: guild.id }, "level profile backfill failed");
    }
  }
}
