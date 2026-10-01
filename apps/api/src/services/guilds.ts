import type { PrismaClient } from "@nexaly/database";
import { evaluateDashboardAccess, guildForbidden, MODULE_KEYS } from "@nexaly/shared";
import type { DiscordOAuthGuild } from "./discord-oauth.js";
import { buildBotInviteUrl } from "./discord-oauth.js";

export interface ManageableGuild {
  id: string;
  name: string;
  icon: string | null;
  iconUrl: string | null;
  botInstalled: boolean;
  accessReason: string;
  inviteUrl: string | null;
}

function iconUrl(guildId: string, icon: string | null): string | null {
  if (!icon) return null;
  const ext = icon.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/icons/${guildId}/${icon}.${ext}`;
}

export async function listManageableGuilds(input: {
  prisma: PrismaClient;
  userId: string;
  oauthGuilds: DiscordOAuthGuild[];
  clientId: string;
}): Promise<ManageableGuild[]> {
  const installed = await input.prisma.guild.findMany({ select: { id: true } });
  const installedIds = new Set(installed.map((g) => g.id));
  const settings = await input.prisma.guildSettings.findMany({
    where: { guildId: { in: input.oauthGuilds.map((g) => g.id) } },
    select: { guildId: true, managerRoleIds: true },
  });
  const managerByGuild = new Map(settings.map((s) => [s.guildId, s.managerRoleIds]));
  const result: ManageableGuild[] = [];

  for (const guild of input.oauthGuilds) {
    const access = evaluateDashboardAccess({
      userId: input.userId,
      ownerId: guild.owner ? input.userId : null,
      isOwnerFlag: guild.owner,
      permissions: guild.permissions,
      managerRoleIds: managerByGuild.get(guild.id) ?? [],
      memberRoleIds: [],
    });
    if (!access.allowed) continue;
    const botInstalled = installedIds.has(guild.id);
    result.push({
      id: guild.id,
      name: guild.name,
      icon: guild.icon,
      iconUrl: iconUrl(guild.id, guild.icon),
      botInstalled,
      accessReason: access.reason,
      inviteUrl: botInstalled ? null : buildBotInviteUrl(input.clientId, guild.id),
    });
  }

  return result.sort((a, b) => a.name.localeCompare(b.name));
}

export async function ensureGuildAccess(input: {
  prisma: PrismaClient;
  userId: string;
  guildId: string;
  oauthGuilds: DiscordOAuthGuild[];
}): Promise<DiscordOAuthGuild> {
  const guild = input.oauthGuilds.find((g) => g.id === input.guildId);
  if (!guild) throw guildForbidden();

  const settings = await input.prisma.guildSettings.findUnique({
    where: { guildId: input.guildId },
    select: { managerRoleIds: true },
  });

  const access = evaluateDashboardAccess({
    userId: input.userId,
    ownerId: guild.owner ? input.userId : null,
    isOwnerFlag: guild.owner,
    permissions: guild.permissions,
    managerRoleIds: settings?.managerRoleIds ?? [],
    memberRoleIds: [],
  });
  if (!access.allowed) throw guildForbidden();
  return guild;
}

export async function upsertInstalledGuild(
  prisma: PrismaClient,
  input: { id: string; name: string; icon?: string | null; ownerId: string; memberCount?: number | null },
): Promise<void> {
  await prisma.guild.upsert({
    where: { id: input.id },
    create: {
      id: input.id,
      name: input.name,
      icon: input.icon ?? null,
      ownerId: input.ownerId,
      memberCount: input.memberCount ?? null,
      botJoinedAt: new Date(),
      settings: { create: {} },
      modules: { create: MODULE_KEYS.map((key) => ({ key, enabled: false })) },
    },
    update: {
      name: input.name,
      icon: input.icon ?? null,
      ownerId: input.ownerId,
      memberCount: input.memberCount ?? undefined,
    },
  });
}
