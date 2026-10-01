import type { Client, GuildMember } from "discord.js";
import type Redis from "ioredis";
import { getModerationConfig } from "./config.js";

export function bindRaidGuard(client: Client, redis: Redis): void {
  client.on("guildMemberAdd", async (member) => {
    try {
      await handleJoin(client, redis, member);
    } catch (error) {
      console.error("raid", error);
    }
  });
}

async function handleJoin(client: Client, redis: Redis, member: GuildMember): Promise<void> {
  const config = await getModerationConfig(member.guild.id);
  if (!config.moduleEnabled || !config.settings?.raidEnabled) return;
  const settings = config.settings;

  const key = `mod:raid:${member.guild.id}`;
  const joins = await redis.incr(key);
  if (joins === 1) await redis.expire(key, settings.raidWindowSec);

  const raidFlag = `mod:raidactive:${member.guild.id}`;
  const alreadyRaiding = Boolean(await redis.get(raidFlag));
  const triggered = joins >= settings.raidJoins;

  if (triggered && !alreadyRaiding) {
    await redis.set(raidFlag, "1", "EX", Math.max(settings.raidWindowSec * 3, 60));
    if (settings.raidAlertChannelId) {
      const channel = member.guild.channels.cache.get(settings.raidAlertChannelId);
      if (channel?.isTextBased()) {
        await channel.send(
          `Raid-Schwelle erreicht: ${joins} Joins in ${settings.raidWindowSec}s. Aktion: ${settings.raidAction}.`,
        ).catch(() => undefined);
      }
    }
    if (settings.raidAction === "LOCKDOWN") {
      const guild = member.guild as typeof member.guild & {
        setIncidentsData?: (data: { invitesDisabledUntil: Date | null }) => Promise<unknown>;
      };
      if (typeof guild.setIncidentsData === "function") {
        await guild
          .setIncidentsData({ invitesDisabledUntil: new Date(Date.now() + 15 * 60 * 1000) })
          .catch(() => undefined);
      }
    }
  }

  const raiding = triggered || alreadyRaiding;
  if (!raiding) return;

  if (settings.raidAction === "RESTRICT_NEW") {
    await member.timeout(10 * 60 * 1000, "Nexaly Raid-Schutz").catch(() => undefined);
  }

  if (settings.raidAction === "VERIFY_GATE" && settings.minAccountAgeHours) {
    const ageHours = (Date.now() - member.user.createdTimestamp) / 3_600_000;
    if (ageHours < settings.minAccountAgeHours) {
      await member.kick(`Nexaly: Account jünger als ${settings.minAccountAgeHours}h während Raid`).catch(
        () => undefined,
      );
    }
  }
}
