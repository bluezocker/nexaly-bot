import type { PrismaClient } from "@nexaly/database";
import { levelFromXp } from "@nexaly/shared";

export const PUBLIC_LEADERBOARD_LIMIT = 100;

export const publicLeaderboardCacheKey = (guildId: string) => `public:leaderboard:v1:${guildId}`;

export interface PublicLeaderboardEntry {
  rank: number;
  name: string;
  avatarUrl: string | null;
  level: number;
  xp: number;
  /** XP im aktuellen Level und XP, die das Level insgesamt braucht */
  intoLevel: number;
  needed: number;
}

export interface PublicLeaderboard {
  guild: { name: string; iconUrl: string | null };
  /** Anzahl aller Mitglieder mit XP und bekanntem Namen */
  total: number;
  entries: PublicLeaderboardEntry[];
}

function guildIconUrl(guildId: string, icon: string | null): string | null {
  if (!icon) return null;
  const ext = icon.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/icons/${guildId}/${icon}.${ext}?size=128`;
}

/** Nur Avatare vom Discord-CDN ausliefern. */
function safeAvatarUrl(url: string | null): string | null {
  return url && /^https:\/\/cdn\.discordapp\.com\/[\w\-./]+(?:\?[\w=&]*)?$/.test(url) ? url : null;
}

/**
 * Lädt die öffentliche Rangliste eines Servers. Liefert null, wenn der Server sie
 * nicht freigegeben hat, das Levelsystem aus ist oder der Bot nicht (mehr) drauf ist.
 * User-IDs werden bewusst nicht herausgegeben.
 */
export async function loadPublicLeaderboard(
  prisma: PrismaClient,
  guildId: string,
): Promise<PublicLeaderboard | null> {
  const [guild, moduleRow, settings] = await Promise.all([
    prisma.guild.findUnique({
      where: { id: guildId },
      select: { name: true, icon: true, botJoinedAt: true },
    }),
    prisma.guildModule.findUnique({ where: { guildId_key: { guildId, key: "levels" } } }),
    prisma.levelSettings.findUnique({ where: { guildId } }),
  ]);
  if (!guild || !guild.botJoinedAt) return null;
  if (!settings?.publicLeaderboard) return null;
  if (!(moduleRow?.enabled ?? settings.enabled)) return null;

  // Ohne Namen (Mitglied hat den Server verlassen, bevor Namen gespeichert wurden) nicht anzeigen.
  const where = { guildId, xp: { gt: 0 }, displayName: { not: null } };
  const [rows, total] = await Promise.all([
    prisma.memberLevel.findMany({
      where,
      orderBy: [{ xp: "desc" }, { userId: "asc" }],
      take: PUBLIC_LEADERBOARD_LIMIT,
      select: { xp: true, displayName: true, avatarUrl: true },
    }),
    prisma.memberLevel.count({ where }),
  ]);

  return {
    guild: { name: guild.name, iconUrl: guildIconUrl(guildId, guild.icon) },
    total,
    entries: rows.map((row: { xp: number; displayName: string | null; avatarUrl: string | null }, index: number) => {
      const curve = levelFromXp(row.xp);
      return {
        rank: index + 1,
        name: row.displayName ?? "Unbekannt",
        avatarUrl: safeAvatarUrl(row.avatarUrl),
        level: curve.level,
        xp: row.xp,
        intoLevel: curve.intoLevel,
        needed: curve.needed,
      };
    }),
  };
}
