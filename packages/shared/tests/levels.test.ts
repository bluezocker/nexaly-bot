import { describe, expect, it } from "vitest";
import { levelFromXp, levelSettingsUpdateSchema, randomXp, totalXpForLevel, xpToNextLevel } from "../src/levels.js";

describe("level curve", () => {
  it("needs 155 XP for level 1", () => {
    expect(xpToNextLevel(1)).toBe(155);
  });

  it("round-trips XP into a level", () => {
    const xp = totalXpForLevel(4) + 10;
    const result = levelFromXp(xp);
    expect(result.level).toBe(4);
    expect(result.intoLevel).toBe(10);
  });

  it("samples XP inclusively", () => {
    expect(randomXp(15, 25, 0)).toBe(15);
    expect(randomXp(15, 25, 0.999)).toBe(25);
  });

  it("rejects inverted min/max", () => {
    const parsed = levelSettingsUpdateSchema.safeParse({
      enabled: true,
      xpMin: 40,
      xpMax: 10,
      cooldownSec: 60,
      announceChannelId: null,
      stackRoles: true,
      ignoredChannelIds: [],
      ignoredRoleIds: [],
      rewards: [],
    });
    expect(parsed.success).toBe(false);
  });
});

describe("öffentliche Rangliste in den Level-Einstellungen", () => {
  const base = {
    enabled: true,
    xpMin: 15,
    xpMax: 25,
    cooldownSec: 60,
    announceChannelId: null,
    stackRoles: true,
    ignoredChannelIds: [],
    ignoredRoleIds: [],
    rewards: [],
  };

  it("ist ohne Angabe ausgeschaltet", () => {
    expect(levelSettingsUpdateSchema.parse(base).publicLeaderboard).toBe(false);
    expect(levelSettingsUpdateSchema.parse({ ...base, publicLeaderboard: true }).publicLeaderboard).toBe(true);
  });
});
