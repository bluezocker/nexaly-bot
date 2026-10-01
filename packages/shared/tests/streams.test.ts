import { describe, expect, it } from "vitest";
import { interpolateStream, streamSubscriptionSchema } from "../src/streams.js";

describe("stream templates", () => {
  it("fills documented placeholders", () => {
    expect(
      interpolateStream("{streamer} live: {title} {url}", {
        streamer: "Ada",
        platform: "twitch",
        title: "Dev",
        url: "https://twitch.tv/ada",
      }),
    ).toBe("Ada live: Dev https://twitch.tv/ada");
  });

  it("rejects unknown platforms", () => {
    expect(
      streamSubscriptionSchema.safeParse({
        platform: "TIKTOK",
        channelKey: "x",
        announceChannelId: "123456789012345678",
        mentionRoleId: null,
        template: null,
        enabled: true,
      }).success,
    ).toBe(false);
  });
});
