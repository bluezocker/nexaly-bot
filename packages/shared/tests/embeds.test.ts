import { describe, expect, it } from "vitest";
import { embedPayloadSchema, toDiscordEmbed } from "../src/embeds.js";

describe("embed payload", () => {
  it("rejects an empty embed", () => {
    expect(embedPayloadSchema.safeParse({ fields: [] }).success).toBe(false);
  });

  it("maps dashboard fields onto the Discord embed shape", () => {
    const parsed = embedPayloadSchema.parse({
      title: "Hallo",
      description: "Text",
      color: 0x7c5cff,
      fields: [{ name: "A", value: "B", inline: true }],
    });
    const discord = toDiscordEmbed(parsed);
    expect(discord.title).toBe("Hallo");
    expect((discord.fields as { name: string }[])[0]?.name).toBe("A");
  });

  it("enforces field limits", () => {
    expect(embedPayloadSchema.safeParse({ title: "x", fields: [{ name: "n", value: "v".repeat(1025) }] }).success).toBe(
      false,
    );
  });
});
