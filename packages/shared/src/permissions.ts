import { PermissionFlags, hasPermission, parsePermissionBits } from "./discord-permissions.js";

export type DashboardAccessReason = "owner" | "administrator" | "manage_guild" | "manager_role" | "none";

export interface GuildPermissionInput {
  userId: string;
  ownerId: string | null;
  isOwnerFlag?: boolean;
  permissions: string | number | bigint;
  memberRoleIds?: string[];
  managerRoleIds?: string[];
}

export interface GuildAccessResult {
  allowed: boolean;
  reason: DashboardAccessReason;
}

export function evaluateDashboardAccess(input: GuildPermissionInput): GuildAccessResult {
  if (input.isOwnerFlag === true || (input.ownerId !== null && input.userId === input.ownerId)) {
    return { allowed: true, reason: "owner" };
  }
  const bits = parsePermissionBits(input.permissions);
  if (hasPermission(bits, PermissionFlags.ADMINISTRATOR)) {
    return { allowed: true, reason: "administrator" };
  }
  if (hasPermission(bits, PermissionFlags.MANAGE_GUILD)) {
    return { allowed: true, reason: "manage_guild" };
  }
  const memberRoles = input.memberRoleIds ?? [];
  const managerRoles = input.managerRoleIds ?? [];
  if (managerRoles.some((roleId) => memberRoles.includes(roleId))) {
    return { allowed: true, reason: "manager_role" };
  }
  return { allowed: false, reason: "none" };
}

export interface HierarchyInput {
  actorIsOwner: boolean;
  targetIsOwner: boolean;
  targetIsBot: boolean;
  actorIsBot: boolean;
  actorHighestPosition: number;
  targetHighestPosition: number;
}

export function evaluateModerationHierarchy(input: HierarchyInput): {
  allowed: boolean;
  code: "ok" | "target_is_owner" | "target_is_bot" | "actor_is_bot" | "role_too_low";
} {
  if (input.targetIsOwner) return { allowed: false, code: "target_is_owner" };
  if (input.targetIsBot) return { allowed: false, code: "target_is_bot" };
  if (input.actorIsBot) return { allowed: false, code: "actor_is_bot" };
  if (input.actorIsOwner) return { allowed: true, code: "ok" };
  if (input.actorHighestPosition <= input.targetHighestPosition) {
    return { allowed: false, code: "role_too_low" };
  }
  return { allowed: true, code: "ok" };
}

export function assertGuildScope(resourceGuildId: string, authorizedGuildId: string): boolean {
  return resourceGuildId === authorizedGuildId;
}
