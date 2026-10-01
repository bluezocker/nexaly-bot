export const PermissionFlags = {
  KICK_MEMBERS: 1n << 1n,
  BAN_MEMBERS: 1n << 2n,
  ADMINISTRATOR: 1n << 3n,
  MANAGE_GUILD: 1n << 5n,
  VIEW_CHANNEL: 1n << 10n,
  SEND_MESSAGES: 1n << 11n,
  MANAGE_MESSAGES: 1n << 13n,
  EMBED_LINKS: 1n << 14n,
  ATTACH_FILES: 1n << 15n,
  READ_MESSAGE_HISTORY: 1n << 16n,
  CONNECT: 1n << 20n,
  MANAGE_NICKNAMES: 1n << 27n,
  MANAGE_ROLES: 1n << 28n,
  MODERATE_MEMBERS: 1n << 40n,
} as const;

export function parsePermissionBits(raw: string | number | bigint): bigint {
  try {
    return BigInt(raw);
  } catch {
    return 0n;
  }
}

export function hasPermission(bits: bigint, flag: bigint): boolean {
  if ((bits & PermissionFlags.ADMINISTRATOR) === PermissionFlags.ADMINISTRATOR) return true;
  return (bits & flag) === flag;
}
