import { describe, expect, it } from "vitest";
import { assertGuildScope, evaluateDashboardAccess, guildForbidden } from "@nexaly/shared";
import { ensureGuildAccess, listManageableGuilds } from "./guilds.js";

describe("guild API isolation", () => {
  it("rejects a guild the user is not in", async () => {
    await expect(
      ensureGuildAccess({
        prisma: { guildSettings: { findUnique: async () => null } } as never,
        userId: "user-1",
        guildId: "222222222222222222",
        oauthGuilds: [
          { id: "111111111111111111", name: "Other", icon: null, owner: true, permissions: "8" },
        ],
      }),
    ).rejects.toMatchObject({ code: "GUILD_FORBIDDEN", statusCode: 403 });
  });

  it("rejects membership without manage rights", async () => {
    await expect(
      ensureGuildAccess({
        prisma: { guildSettings: { findUnique: async () => ({ managerRoleIds: [] }) } } as never,
        userId: "user-1",
        guildId: "111111111111111111",
        oauthGuilds: [
          { id: "111111111111111111", name: "No perms", icon: null, owner: false, permissions: "0" },
        ],
      }),
    ).rejects.toMatchObject({ code: "GUILD_FORBIDDEN" });
  });

  it("allows the owner of the requested guild", async () => {
    const guild = await ensureGuildAccess({
      prisma: { guildSettings: { findUnique: async () => null } } as never,
      userId: "user-1",
      guildId: "111111111111111111",
      oauthGuilds: [
        { id: "111111111111111111", name: "Mine", icon: null, owner: true, permissions: "0" },
      ],
    });
    expect(guild.name).toBe("Mine");
    expect(
      evaluateDashboardAccess({
        userId: "user-1",
        ownerId: "user-1",
        isOwnerFlag: true,
        permissions: "0",
      }).allowed,
    ).toBe(true);
  });

  it("lists only guilds the user can manage", async () => {
    const guilds = await listManageableGuilds({
      prisma: {
        guild: { findMany: async () => [{ id: "111111111111111111" }] },
        guildSettings: { findMany: async () => [] },
      } as never,
      userId: "user-1",
      clientId: "client",
      oauthGuilds: [
        { id: "111111111111111111", name: "Mine", icon: null, owner: true, permissions: "0" },
        { id: "222222222222222222", name: "Lurk", icon: null, owner: false, permissions: "0" },
      ],
    });
    expect(guilds.map((g) => g.id)).toEqual(["111111111111111111"]);
    expect(guilds[0]?.botInstalled).toBe(true);
  });

  it("resource guild ids must match authorized scope", () => {
    expect(assertGuildScope("1", "2")).toBe(false);
    expect(() => {
      if (!assertGuildScope("aaa", "bbb")) throw guildForbidden();
    }).toThrow();
  });
});
