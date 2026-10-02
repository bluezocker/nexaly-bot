import { describe, expect, it } from "vitest";
import type { TranscriptInput } from "@nexaly/shared";
import { lastRelevantMessageId, renderWithinLimit } from "./ticket-transcript.js";

const BOT = "999";

describe("lastRelevantMessageId", () => {
  it("ignoriert Nachrichten des Bots am Ende", () => {
    expect(
      lastRelevantMessageId(
        [
          { id: "1", authorId: BOT },
          { id: "2", authorId: "42" },
          { id: "3", authorId: BOT },
        ],
        BOT,
      ),
    ).toBe("2");
  });

  it("liefert 'none', wenn nur der Bot geschrieben hat", () => {
    expect(lastRelevantMessageId([{ id: "1", authorId: BOT }], BOT)).toBe("none");
    expect(lastRelevantMessageId([], BOT)).toBe("none");
  });

  it("ändert sich, wenn nach dem Schließen noch jemand schreibt", () => {
    const atClose = [{ id: "1", authorId: "42" }, { id: "2", authorId: BOT }];
    const atDelete = [...atClose, { id: "3", authorId: "7" }];
    expect(lastRelevantMessageId(atClose, BOT)).not.toBe(lastRelevantMessageId(atDelete, BOT));
  });
});

describe("renderWithinLimit", () => {
  const input = (count: number, withImage: boolean): TranscriptInput => ({
    guildName: "Server",
    ticketNumber: 1,
    ownerName: "Ben",
    ownerId: "42",
    openedAt: "2026-10-01T10:00:00.000Z",
    messages: Array.from({ length: count }, (_, i) => ({
      id: String(i),
      authorId: "42",
      authorName: "Ben",
      isBot: false,
      timestamp: "2026-10-01T10:00:00.000Z",
      content: `Nachricht ${i} ${"x".repeat(200)}`,
      attachments: withImage
        ? [{ name: "a.png", url: "https://cdn.discordapp.com/a.png", sizeBytes: 3000, dataUri: `data:image/png;base64,${"A".repeat(4000)}` }]
        : [],
    })),
  });

  it("lässt kleine Protokolle unverändert", () => {
    const html = renderWithinLimit(input(3, true)).toString("utf8");
    expect(html).toContain("data:image/png;base64,");
    expect(html).not.toContain("gekürzt");
  });

  it("entfernt zuerst eingebettete Bilder", () => {
    const html = renderWithinLimit(input(20, true), 30_000).toString("utf8");
    expect(html).not.toContain("data:image/png;base64,");
    expect(html).toContain("Nachricht 0 ");
    expect(html).not.toContain("gekürzt");
  });

  it("kürzt danach ältere Nachrichten und behält die neuesten", () => {
    const buffer = renderWithinLimit(input(200, false), 30_000);
    const html = buffer.toString("utf8");
    expect(buffer.byteLength).toBeLessThanOrEqual(30_000);
    expect(html).toContain("gekürzt");
    expect(html).toContain("Nachricht 199 ");
    expect(html).not.toContain("Nachricht 0 ");
  });
});
