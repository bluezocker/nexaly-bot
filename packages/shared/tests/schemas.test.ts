import { describe, expect, it } from "vitest";
import {
  embedSendSchema,
  embedTemplateSchema,
  levelSettingsUpdateSchema,
  logSettingsUpdateSchema,
  moderationSettingsUpdateSchema,
  streamSubscriptionSchema,
  welcomeSettingsUpdateSchema,
} from "../src/index.js";

const snowflake = "123456789012345678";

describe("update schemas reject mass assignment", () => {
  it("log settings reject unknown keys", () => {
    expect(
      logSettingsUpdateSchema.safeParse({
        enabled: true,
        events: {},
        guildId: "attacker",
      }).success,
    ).toBe(false);
  });

  it("moderation settings reject extra guildId", () => {
    const base = {
      enabled: true,
      logChannelId: null,
      ignoreRoleIds: [],
      ignoreChannelIds: [],
      spamEnabled: true,
      spamMessages: 5,
      spamWindowSec: 5,
      duplicateEnabled: true,
      duplicateCount: 3,
      mentionLimit: 8,
      emojiLimit: 12,
      capsPercent: 80,
      capsMinLength: 12,
      linkSpamLimit: 4,
      inviteBlock: true,
      allowedDomains: [],
      blockedDomains: [],
      raidEnabled: false,
      raidJoins: 10,
      raidWindowSec: 15,
      raidAction: "ALERT",
      raidAlertChannelId: null,
      minAccountAgeHours: null,
      ladder: [],
    };
    expect(moderationSettingsUpdateSchema.safeParse(base).success).toBe(true);
    expect(moderationSettingsUpdateSchema.safeParse({ ...base, guildId: snowflake }).success).toBe(false);
  });

  it("welcome sliders stay in 0..1", () => {
    expect(
      welcomeSettingsUpdateSchema.safeParse({
        enabled: true,
        channelId: snowflake,
        sendDm: false,
        dmTemplate: null,
        mode: "TEXT",
        textTemplate: "hi",
        embedJson: null,
        backgroundAssetId: null,
        textColor: "#ffffff",
        accentColor: "#7c5cff",
        avatarX: 0,
        avatarY: 1,
        nameX: 0.5,
        nameY: 0.5,
        customText: null,
      }).success,
    ).toBe(true);
  });

  it("level rewards require snowflake role ids", () => {
    expect(
      levelSettingsUpdateSchema.safeParse({
        enabled: true,
        xpMin: 15,
        xpMax: 25,
        cooldownSec: 60,
        announceChannelId: null,
        stackRoles: true,
        ignoredChannelIds: [],
        ignoredRoleIds: [],
        rewards: [{ level: 5, roleId: "not-a-snowflake" }],
      }).success,
    ).toBe(false);
  });

  it("embed send requires a channel of this request body only", () => {
    expect(embedSendSchema.safeParse({ channelId: snowflake }).success).toBe(false);
    expect(
      embedSendSchema.safeParse({
        channelId: snowflake,
        embed: { title: "Hi", fields: [] },
      }).success,
    ).toBe(true);
    expect(
      embedTemplateSchema.safeParse({
        name: "x",
        embed: { fields: [] },
      }).success,
    ).toBe(false);
  });

  it("stream subscription requires a known platform", () => {
    expect(
      streamSubscriptionSchema.safeParse({
        platform: "TWITCH",
        channelKey: "ada",
        announceChannelId: snowflake,
        mentionRoleId: null,
        template: null,
        enabled: true,
      }).success,
    ).toBe(true);
  });
});
