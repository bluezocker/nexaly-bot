import { z } from "zod";

const snowflake = z.string().regex(/^\d{17,20}$/);

export const levelSettingsUpdateSchema = z
  .object({
    enabled: z.boolean(),
    xpMin: z.number().int().min(1).max(100),
    xpMax: z.number().int().min(1).max(200),
    cooldownSec: z.number().int().min(5).max(300),
    announceChannelId: snowflake.nullable(),
    stackRoles: z.boolean(),
    ignoredChannelIds: z.array(snowflake).max(50),
    ignoredRoleIds: z.array(snowflake).max(25),
    rewards: z
      .array(
        z.object({
          level: z.number().int().min(1).max(500),
          roleId: snowflake,
        }),
      )
      .max(50),
  })
  .strict()
  .refine((value) => value.xpMax >= value.xpMin, { message: "xpMax must be >= xpMin" });

export type LevelSettingsUpdate = z.infer<typeof levelSettingsUpdateSchema>;

/** Mee6-style curve: XP required to go from level n-1 to n. */
export function xpToNextLevel(level: number): number {
  const n = Math.max(1, Math.floor(level));
  return 5 * n * n + 50 * n + 100;
}

export function totalXpForLevel(level: number): number {
  let total = 0;
  for (let i = 1; i <= level; i += 1) total += xpToNextLevel(i);
  return total;
}

export function levelFromXp(xp: number): { level: number; intoLevel: number; needed: number } {
  let remaining = Math.max(0, Math.floor(xp));
  let level = 0;
  while (true) {
    const needed = xpToNextLevel(level + 1);
    if (remaining < needed) return { level, intoLevel: remaining, needed };
    remaining -= needed;
    level += 1;
    if (level >= 1000) return { level, intoLevel: remaining, needed };
  }
}

export function randomXp(min: number, max: number, sample: number): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return lo + Math.floor(sample * (hi - lo + 1));
}
