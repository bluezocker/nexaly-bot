import { describe, expect, it } from "vitest";
import { parseYoutubeFeedVideoIds } from "../src/index.js";

const feed = `<?xml version="1.0"?><feed xmlns:yt="http://www.youtube.com/xml/schemas/2015">
<entry><yt:videoId>abc123DEF_-</yt:videoId></entry>
<entry><yt:videoId>xyz987LMN00</yt:videoId></entry>
<entry><yt:videoId>abc123DEF_-</yt:videoId></entry>
</feed>`;

describe("parseYoutubeFeedVideoIds", () => {
  it("liest Video-IDs ohne Duplikate", () => {
    expect(parseYoutubeFeedVideoIds(feed)).toEqual(["abc123DEF_-", "xyz987LMN00"]);
  });
  it("beachtet das Limit", () => {
    expect(parseYoutubeFeedVideoIds(feed, 1)).toEqual(["abc123DEF_-"]);
  });
  it("leerer Feed ergibt keine IDs", () => {
    expect(parseYoutubeFeedVideoIds("<feed></feed>")).toEqual([]);
  });
});
