import { Collection } from "discord.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  findMany: vi.fn(),
  update: vi.fn(async () => ({})),
}));
vi.mock("@nexaly/database", () => ({ prisma: { memberLevel: db } }));

import { backfillGuildLevelProfiles } from "./backfill.js";

function fakeGuild(presentIds: string[]) {
  const fetchCalls: string[][] = [];
  const guild = {
    id: "1",
    members: {
      fetch: async ({ user }: { user: string[] }) => {
        fetchCalls.push(user);
        return new Collection(
          user
            .filter((id) => presentIds.includes(id))
            .map((id) => [
              id,
              { id, displayName: `Name ${id}`, displayAvatarURL: () => `https://cdn.discordapp.com/avatars/${id}/a.png?size=128` },
            ]),
        );
      },
    },
  };
  return { guild: guild as never, fetchCalls };
}

describe("backfillGuildLevelProfiles", () => {
  beforeEach(() => {
    db.findMany.mockReset();
    db.update.mockClear();
  });

  it("fragt Mitglieder in Blöcken von 100 ab und speichert nur vorhandene", async () => {
    const ids = Array.from({ length: 250 }, (_, i) => String(1000 + i));
    db.findMany.mockResolvedValue(ids.map((userId) => ({ userId })));
    const { guild, fetchCalls } = fakeGuild(["1000", "1150", "1249"]); // der Rest hat den Server verlassen

    await expect(backfillGuildLevelProfiles(guild)).resolves.toBe(3);
    expect(fetchCalls.map((chunk) => chunk.length)).toEqual([100, 100, 50]);
    expect(db.update).toHaveBeenCalledTimes(3);
    expect(db.update).toHaveBeenCalledWith({
      where: { guildId_userId: { guildId: "1", userId: "1150" } },
      data: { displayName: "Name 1150", avatarUrl: "https://cdn.discordapp.com/avatars/1150/a.png?size=128" },
    });
  });

  it("macht nichts, wenn alle Einträge schon einen Namen haben", async () => {
    db.findMany.mockResolvedValue([]);
    const { guild, fetchCalls } = fakeGuild([]);
    await expect(backfillGuildLevelProfiles(guild)).resolves.toBe(0);
    expect(fetchCalls).toHaveLength(0);
    expect(db.findMany.mock.calls[0]?.[0].where).toMatchObject({ guildId: "1", displayName: null });
  });
});
