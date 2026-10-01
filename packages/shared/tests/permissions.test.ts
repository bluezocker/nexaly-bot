import { describe, expect, it } from "vitest";
import {
  assertGuildScope,
  evaluateDashboardAccess,
  evaluateModerationHierarchy,
  hasPermission,
  parsePermissionBits,
  PermissionFlags,
} from "../src/index.js";

const USER = "100";
const OWNER = "200";

describe("evaluateDashboardAccess", () => {
  it("allows the guild owner via ownerId", () => {
    expect(evaluateDashboardAccess({ userId: OWNER, ownerId: OWNER, permissions: "0" })).toEqual({
      allowed: true,
      reason: "owner",
    });
  });

  it("allows ADMINISTRATOR even without manage_guild bit", () => {
    expect(
      evaluateDashboardAccess({
        userId: USER,
        ownerId: OWNER,
        permissions: PermissionFlags.ADMINISTRATOR.toString(),
      }).reason,
    ).toBe("administrator");
  });

  it("allows MANAGE_GUILD", () => {
    expect(
      evaluateDashboardAccess({
        userId: USER,
        ownerId: OWNER,
        permissions: PermissionFlags.MANAGE_GUILD.toString(),
      }).reason,
    ).toBe("manage_guild");
  });

  it("allows a configured manager role", () => {
    expect(
      evaluateDashboardAccess({
        userId: USER,
        ownerId: OWNER,
        permissions: "0",
        memberRoleIds: ["role-mod"],
        managerRoleIds: ["role-mod"],
      }).reason,
    ).toBe("manager_role");
  });

  it("does not treat a role on another guild as manager", () => {
    expect(
      evaluateDashboardAccess({
        userId: USER,
        ownerId: OWNER,
        permissions: "0",
        memberRoleIds: ["role-from-other-guild"],
        managerRoleIds: ["role-mod"],
      }).allowed,
    ).toBe(false);
  });

  it("denies members without elevated rights", () => {
    expect(
      evaluateDashboardAccess({
        userId: USER,
        ownerId: OWNER,
        permissions: PermissionFlags.SEND_MESSAGES.toString(),
        memberRoleIds: ["everyone"],
        managerRoleIds: ["admins"],
      }),
    ).toEqual({ allowed: false, reason: "none" });
  });
});

describe("evaluateModerationHierarchy", () => {
  it("blocks acting on the owner", () => {
    expect(
      evaluateModerationHierarchy({
        actorIsOwner: false,
        targetIsOwner: true,
        targetIsBot: false,
        actorIsBot: false,
        actorHighestPosition: 50,
        targetHighestPosition: 0,
      }).code,
    ).toBe("target_is_owner");
  });

  it("blocks equal or higher target roles", () => {
    expect(
      evaluateModerationHierarchy({
        actorIsOwner: false,
        targetIsOwner: false,
        targetIsBot: false,
        actorIsBot: false,
        actorHighestPosition: 5,
        targetHighestPosition: 5,
      }).code,
    ).toBe("role_too_low");
  });

  it("allows a higher role acting on a lower role", () => {
    expect(
      evaluateModerationHierarchy({
        actorIsOwner: false,
        targetIsOwner: false,
        targetIsBot: false,
        actorIsBot: false,
        actorHighestPosition: 10,
        targetHighestPosition: 3,
      }).allowed,
    ).toBe(true);
  });

  it("lets the owner moderate a higher-position member", () => {
    expect(
      evaluateModerationHierarchy({
        actorIsOwner: true,
        targetIsOwner: false,
        targetIsBot: false,
        actorIsBot: false,
        actorHighestPosition: 0,
        targetHighestPosition: 99,
      }).allowed,
    ).toBe(true);
  });

  it("blocks the bot as target and actor-as-bot", () => {
    expect(
      evaluateModerationHierarchy({
        actorIsOwner: true,
        targetIsOwner: false,
        targetIsBot: true,
        actorIsBot: false,
        actorHighestPosition: 10,
        targetHighestPosition: 0,
      }).code,
    ).toBe("target_is_bot");
    expect(
      evaluateModerationHierarchy({
        actorIsOwner: false,
        targetIsOwner: false,
        targetIsBot: false,
        actorIsBot: true,
        actorHighestPosition: 10,
        targetHighestPosition: 0,
      }).code,
    ).toBe("actor_is_bot");
  });
});

describe("permission bits", () => {
  it("parses decimal strings and treats administrator as all flags", () => {
    expect(parsePermissionBits("8")).toBe(8n);
    expect(hasPermission(PermissionFlags.ADMINISTRATOR, PermissionFlags.BAN_MEMBERS)).toBe(true);
    expect(hasPermission(PermissionFlags.SEND_MESSAGES, PermissionFlags.BAN_MEMBERS)).toBe(false);
  });

  it("returns 0n for garbage input", () => {
    expect(parsePermissionBits("not-a-number")).toBe(0n);
  });
});

describe("assertGuildScope", () => {
  it("prevents cross-tenant access", () => {
    expect(assertGuildScope("guild-a", "guild-b")).toBe(false);
    expect(assertGuildScope("guild-a", "guild-a")).toBe(true);
  });
});
