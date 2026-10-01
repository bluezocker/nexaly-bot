import { afterEach, describe, expect, it } from "vitest";
import { ensureGuildAccess, listManageableGuilds, setMemberRoleLookup } from "./guilds.js";

const guildId = "111111111111111111";
const plainMember = { id: guildId, name: "Server", icon: null, owner: false, permissions: "0" };

function prismaWith(managerRoleIds: string[], installed = true) {
  return {
    guildSettings: {
      findUnique: async () => ({ managerRoleIds }),
      findMany: async () => [{ guildId, managerRoleIds }],
    },
    guild: { findMany: async () => (installed ? [{ id: guildId }] : []) },
  } as never;
}

afterEach(() => setMemberRoleLookup(null));

describe("Manager-Rollen", () => {
  it("erlaubt Zugriff, wenn das Mitglied eine Manager-Rolle hat", async () => {
    setMemberRoleLookup(async () => ["999", "555"]);
    await expect(
      ensureGuildAccess({ prisma: prismaWith(["555"]), userId: "u1", guildId, oauthGuilds: [plainMember] }),
    ).resolves.toMatchObject({ id: guildId });
  });

  it("verweigert Zugriff ohne passende Rolle", async () => {
    setMemberRoleLookup(async () => ["999"]);
    await expect(
      ensureGuildAccess({ prisma: prismaWith(["555"]), userId: "u1", guildId, oauthGuilds: [plainMember] }),
    ).rejects.toMatchObject({ code: "GUILD_FORBIDDEN" });
  });

  it("fragt Rollen nicht ab, wenn keine Manager-Rollen eingestellt sind", async () => {
    let calls = 0;
    setMemberRoleLookup(async () => {
      calls++;
      return [];
    });
    await expect(
      ensureGuildAccess({ prisma: prismaWith([]), userId: "u1", guildId, oauthGuilds: [plainMember] }),
    ).rejects.toMatchObject({ code: "GUILD_FORBIDDEN" });
    expect(calls).toBe(0);
  });

  it("verweigert Zugriff, wenn Discord nicht erreichbar ist", async () => {
    setMemberRoleLookup(async () => {
      throw new Error("down");
    });
    await expect(
      ensureGuildAccess({ prisma: prismaWith(["555"]), userId: "u1", guildId, oauthGuilds: [plainMember] }),
    ).rejects.toMatchObject({ code: "GUILD_FORBIDDEN" });
  });

  it("zeigt den Server in der Serverliste für Manager", async () => {
    setMemberRoleLookup(async () => ["555"]);
    const guilds = await listManageableGuilds({
      prisma: prismaWith(["555"]),
      userId: "u1",
      oauthGuilds: [plainMember],
      clientId: "1",
    });
    expect(guilds.map((g) => g.accessReason)).toEqual(["manager_role"]);
  });
});
