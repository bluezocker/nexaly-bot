import { describe, expect, it } from "vitest";
import { interpolateWelcome, welcomeSettingsUpdateSchema, welcomeVars } from "../src/welcome.js";

describe("welcome templates", () => {
  it("replaces documented placeholders only", () => {
    const vars = welcomeVars({
      username: "Ada",
      userId: "42",
      guildName: "Nexaly HQ",
      memberCount: 12,
    });
    expect(interpolateWelcome("Hi {user.name} in {server} #{memberCount}", vars)).toBe(
      "Hi Ada in Nexaly HQ #12",
    );
    expect(interpolateWelcome("{user}", vars)).toBe("<@42>");
  });

  it("does not invent extra placeholders", () => {
    const vars = welcomeVars({
      username: "Ada",
      userId: "42",
      guildName: "Nexaly HQ",
      memberCount: 1,
    });
    expect(interpolateWelcome("{unknown}", vars)).toBe("{unknown}");
  });

  it("rejects invalid slider values and extra fields", () => {
    const parsed = welcomeSettingsUpdateSchema.safeParse({
      enabled: true,
      channelId: null,
      sendDm: false,
      dmTemplate: null,
      mode: "TEXT",
      textTemplate: "hi",
      embedJson: null,
      backgroundAssetId: null,
      textColor: "#ffffff",
      accentColor: "#7c5cff",
      avatarX: 1.4,
      avatarY: 0.2,
      nameX: 0.5,
      nameY: 0.6,
      customText: null,
      extra: true,
    });
    expect(parsed.success).toBe(false);
  });
});
