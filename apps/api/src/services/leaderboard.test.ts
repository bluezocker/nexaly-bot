import { describe, expect, it } from "vitest";
import { loadPublicLeaderboard } from "./leaderboard.js";

const GUILD = "111111111111111111";

function fakePrisma(options: {
  guild?: { name: string; icon: string | null; botJoinedAt: Date | null } | null;
  moduleEnabled?: boolean | null;
  settings?: { enabled: boolean; publicLeaderboard: boolean } | null;
  rows?: { userId: string; xp: number; displayName: string | null; avatarUrl: string | null }[];
}) {
  const rows = options.rows ?? [];
  const calls: any[] = [];
  const filter = (where: any) =>
    rows.filter((row) => row.xp > 0 && (where.displayName?.not === null ? row.displayName !== null : true));
  const prisma = {
    guild: {
      findUnique: async () =>
        options.guild === undefined ? { name: "Testserver", icon: "abc", botJoinedAt: new Date() } : options.guild,
    },
    guildModule: {
      findUnique: async () => (options.moduleEnabled == null ? null : { enabled: options.moduleEnabled }),
    },
    levelSettings: {
      findUnique: async () =>
        options.settings === undefined ? { enabled: true, publicLeaderboard: true } : options.settings,
    },
    memberLevel: {
      findMany: async (args: any) => {
        calls.push(args);
        return filter(args.where)
          .sort((a, b) => b.xp - a.xp || a.userId.localeCompare(b.userId))
          .slice(0, args.take);
      },
      count: async (args: any) => filter(args.where).length,
    },
  };
  return { prisma: prisma as never, calls };
}

describe("loadPublicLeaderboard", () => {
  it("liefert nichts, wenn die Rangliste nicht freigegeben ist", async () => {
    const { prisma } = fakePrisma({ settings: { enabled: true, publicLeaderboard: false } });
    expect(await loadPublicLeaderboard(prisma, GUILD)).toBeNull();
  });

  it("liefert nichts ohne Einstellungen, ohne Server oder wenn der Bot entfernt wurde", async () => {
    expect(await loadPublicLeaderboard(fakePrisma({ settings: null }).prisma, GUILD)).toBeNull();
    expect(await loadPublicLeaderboard(fakePrisma({ guild: null }).prisma, GUILD)).toBeNull();
    expect(
      await loadPublicLeaderboard(fakePrisma({ guild: { name: "X", icon: null, botJoinedAt: null } }).prisma, GUILD),
    ).toBeNull();
  });

  it("liefert nichts, wenn das Levelsystem ausgeschaltet ist", async () => {
    const { prisma } = fakePrisma({ moduleEnabled: false });
    expect(await loadPublicLeaderboard(prisma, GUILD)).toBeNull();
  });

  it("sortiert nach XP, vergibt Ränge und gibt keine User-IDs heraus", async () => {
    const { prisma } = fakePrisma({
      rows: [
        { userId: "2", xp: 100, displayName: "Bea", avatarUrl: "https://cdn.discordapp.com/avatars/2/b.png?size=128" },
        { userId: "1", xp: 1500, displayName: "Alex", avatarUrl: null },
        { userId: "3", xp: 400, displayName: null, avatarUrl: null }, // ohne Namen: nicht anzeigen
        { userId: "4", xp: 0, displayName: "Null XP", avatarUrl: null },
      ],
    });
    const result = await loadPublicLeaderboard(prisma, GUILD);
    expect(result?.guild).toEqual({
      name: "Testserver",
      iconUrl: `https://cdn.discordapp.com/icons/${GUILD}/abc.png?size=128`,
    });
    expect(result?.total).toBe(2);
    expect(result?.entries.map((entry) => [entry.rank, entry.name, entry.xp])).toEqual([
      [1, "Alex", 1500],
      [2, "Bea", 100],
    ]);
    expect(JSON.stringify(result)).not.toContain("userId");
    // 1500 XP: Level 1 braucht 155, Level 2 220, Level 3 295, Level 4 380, Level 5 475 -> Level 4, 450 im Level
    expect(result?.entries[0]).toMatchObject({ level: 4, intoLevel: 450, needed: 475 });
  });

  it("gibt nur Avatare vom Discord-CDN heraus", async () => {
    const { prisma } = fakePrisma({
      rows: [
        { userId: "1", xp: 10, displayName: "A", avatarUrl: "https://evil.example/x.png" },
        { userId: "2", xp: 5, displayName: "B", avatarUrl: 'https://cdn.discordapp.com/a.png" onerror="x' },
      ],
    });
    const result = await loadPublicLeaderboard(prisma, GUILD);
    expect(result?.entries.map((entry) => entry.avatarUrl)).toEqual([null, null]);
  });

  it("begrenzt auf 100 Einträge und nennt die Gesamtzahl", async () => {
    const rows = Array.from({ length: 130 }, (_, i) => ({
      userId: String(i).padStart(3, "0"),
      xp: 1000 - i,
      displayName: `U${i}`,
      avatarUrl: null,
    }));
    const result = await loadPublicLeaderboard(fakePrisma({ rows }).prisma, GUILD);
    expect(result?.entries).toHaveLength(100);
    expect(result?.total).toBe(130);
    expect(result?.entries.at(-1)?.rank).toBe(100);
  });
});
