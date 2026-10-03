import { prisma } from "@nexaly/database";
import { levelFromXp, randomXp } from "@nexaly/shared";
import type { GuildMember, TextBasedChannel } from "discord.js";
import type Redis from "ioredis";
import type { LevelRuntime } from "./config.js";

export async function grantMessageXp(input: {
  redis: Redis;
  member: GuildMember;
  channelId: string;
  config: LevelRuntime;
}): Promise<void> {
  const { member, config } = input;
  if (!config.enabled) return;
  if (member.user.bot) return;
  if (config.ignoredChannelIds.includes(input.channelId)) return;
  if (member.roles.cache.some((role) => config.ignoredRoleIds.includes(role.id))) return;

  const cdKey = `lvl:cd:${member.guild.id}:${member.id}`;
  const locked = await input.redis.set(cdKey, "1", "EX", config.cooldownSec, "NX");
  if (!locked) return;

  const gain = randomXp(config.xpMin, config.xpMax, Math.random());
  const current = await prisma.memberLevel.findUnique({
    where: { guildId_userId: { guildId: member.guild.id, userId: member.id } },
  });
  const xp = (current?.xp ?? 0) + gain;
  const before = current?.level ?? 0;
  const after = levelFromXp(xp).level;

  // Name und Avatar mitschreiben, damit Ranglisten ohne Discord-Abfrage auskommen.
  const profile = memberProfile(member);
  await prisma.memberLevel.upsert({
    where: { guildId_userId: { guildId: member.guild.id, userId: member.id } },
    create: { guildId: member.guild.id, userId: member.id, xp, level: after, lastXpAt: new Date(), ...profile },
    update: { xp, level: after, lastXpAt: new Date(), ...profile },
  });

  if (after > before) {
    await applyRewards(member, after, config);
    const channel =
      (config.announceChannelId
        ? member.guild.channels.cache.get(config.announceChannelId)
        : member.guild.channels.cache.get(input.channelId)) ?? null;
    if (channel && "send" in channel) {
      await (channel as TextBasedChannel)
        .send(`${member} hat Level **${after}** erreicht.`)
        .catch(() => undefined);
    }
  }
}

export function memberProfile(member: GuildMember): { displayName: string; avatarUrl: string } {
  return {
    displayName: member.displayName.slice(0, 64),
    avatarUrl: member.displayAvatarURL({ extension: "png", size: 128 }),
  };
}

async function applyRewards(member: GuildMember, level: number, config: LevelRuntime): Promise<void> {
  const earned = config.rewards.filter((reward) => reward.level <= level);
  if (!earned.length) return;
  if (!config.stackRoles) {
    const highest = earned[earned.length - 1];
    if (highest) {
      await member.roles.add(highest.roleId).catch(() => undefined);
      for (const reward of earned.slice(0, -1)) {
        if (member.roles.cache.has(reward.roleId)) {
          await member.roles.remove(reward.roleId).catch(() => undefined);
        }
      }
    }
    return;
  }
  for (const reward of earned) {
    if (!member.roles.cache.has(reward.roleId)) {
      await member.roles.add(reward.roleId).catch(() => undefined);
    }
  }
}
