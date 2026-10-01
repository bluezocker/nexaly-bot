import { prisma } from "@nexaly/database";

export interface LevelRuntime {
  enabled: boolean;
  xpMin: number;
  xpMax: number;
  cooldownSec: number;
  announceChannelId: string | null;
  stackRoles: boolean;
  ignoredChannelIds: string[];
  ignoredRoleIds: string[];
  rewards: { level: number; roleId: string }[];
}

const cache = new Map<string, LevelRuntime>();

export function invalidateLevelConfig(guildId: string): void {
  cache.delete(guildId);
}

export async function getLevelConfig(guildId: string): Promise<LevelRuntime | null> {
  const cached = cache.get(guildId);
  if (cached) return cached;
  const [moduleRow, settings, rewards] = await Promise.all([
    prisma.guildModule.findUnique({ where: { guildId_key: { guildId, key: "levels" } } }),
    prisma.levelSettings.findUnique({ where: { guildId } }),
    prisma.levelReward.findMany({ where: { guildId }, orderBy: { level: "asc" } }),
  ]);
  if (!settings && !moduleRow?.enabled) return null;
  const runtime: LevelRuntime = {
    enabled: moduleRow?.enabled ?? settings?.enabled ?? false,
    xpMin: settings?.xpMin ?? 15,
    xpMax: settings?.xpMax ?? 25,
    cooldownSec: settings?.cooldownSec ?? 60,
    announceChannelId: settings?.announceChannelId ?? null,
    stackRoles: settings?.stackRoles ?? true,
    ignoredChannelIds: settings?.ignoredChannelIds ?? [],
    ignoredRoleIds: settings?.ignoredRoleIds ?? [],
    rewards: rewards.map((row) => ({ level: row.level, roleId: row.roleId })),
  };
  cache.set(guildId, runtime);
  return runtime;
}
