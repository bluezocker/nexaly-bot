import { Collection } from "discord.js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { saveTicketTranscript, TranscriptError } from "./ticket-transcript.js";

const BOT = "999";

function fakeMessage(id: number, authorId: string, content: string) {
  return {
    id: String(id),
    author: {
      id: authorId,
      bot: authorId === BOT,
      username: `user${authorId}`,
      displayName: `User ${authorId}`,
      displayAvatarURL: () => `https://cdn.discordapp.com/embed/avatars/0.png`,
    },
    member: null,
    cleanContent: content,
    stickers: new Collection(),
    embeds: [],
    attachments: new Collection(),
    createdAt: new Date(1_760_000_000_000 + id * 1000),
    createdTimestamp: 1_760_000_000_000 + id * 1000,
    editedTimestamp: null,
  };
}

function setup(messages: ReturnType<typeof fakeMessage>[], options: { missing?: string[]; failFetch?: boolean } = {}) {
  const sent: any[] = [];
  const fetchCalls: any[] = [];
  const store = new Map<string, string>();
  const logChannel = {
    isTextBased: () => true,
    permissionsFor: () => ({ missing: () => options.missing ?? [] }),
    send: async (payload: any) => {
      sent.push(payload);
    },
  };
  const guild = {
    id: "1",
    name: "Testserver",
    client: { user: { id: BOT } },
    channels: { cache: new Map([["500", logChannel]]), fetch: async () => null },
    members: { me: { id: BOT }, fetch: async () => null },
  };
  const channel = {
    id: "600",
    messages: {
      // Discord liefert die neuesten zuerst, maximal `limit` Stück vor `before`
      fetch: async ({ limit, before }: { limit: number; before?: string }) => {
        fetchCalls.push({ limit, before });
        if (options.failFetch) throw new Error("Missing Access");
        const newestFirst = [...messages].sort((a, b) => Number(b.id) - Number(a.id));
        const page = newestFirst.filter((m) => !before || Number(m.id) < Number(before)).slice(0, limit);
        return new Collection(page.map((m) => [m.id, m]));
      },
    },
  };
  const redis = {
    get: async (key: string) => store.get(key) ?? null,
    set: async (key: string, value: string) => {
      store.set(key, value);
      return "OK";
    },
  };
  const ticket = { id: "t1", number: 12, ownerId: "42", createdAt: new Date(1_760_000_000_000), closedAt: null };
  const closedBy = { id: "7", username: "mod", displayName: "Mod" };
  const run = (extra: { onlyIfChanged?: boolean; logChannelId?: string | null } = {}) =>
    saveTicketTranscript({
      guild: guild as never,
      channel: channel as never,
      ticket,
      logChannelId: "logChannelId" in extra ? (extra.logChannelId ?? null) : "500",
      closedBy: closedBy as never,
      redis: redis as never,
      onlyIfChanged: extra.onlyIfChanged,
    });
  return { run, sent, fetchCalls, store, messages };
}

// Keine echten Netzwerkzugriffe im Test: Avatar-Downloads schlagen fehl, es bleibt die CDN-Adresse.
beforeAll(() => vi.stubGlobal("fetch", async () => new Response(null, { status: 404 })));
afterAll(() => vi.unstubAllGlobals());

describe("saveTicketTranscript", () => {
  it("sendet das Protokoll mit allen Nachrichten in zeitlicher Reihenfolge", async () => {
    const messages = Array.from({ length: 150 }, (_, i) => fakeMessage(i + 1, i % 2 ? "42" : "7", `Text ${i + 1}!`));
    const ctx = setup(messages);
    await expect(ctx.run()).resolves.toBe("sent");

    expect(ctx.fetchCalls).toHaveLength(2); // 100 + 50
    expect(ctx.sent).toHaveLength(1);
    const payload = ctx.sent[0];
    expect(payload.allowedMentions).toEqual({ parse: [] });
    expect(payload.files[0].name).toBe("ticket-0012.html");
    const html = (payload.files[0].attachment as Buffer).toString("utf8");
    expect(html.indexOf("Text 1!")).toBeGreaterThan(-1);
    expect(html.indexOf("Text 1!")).toBeLessThan(html.indexOf("Text 150!"));
    expect(payload.embeds[0].fields.find((f: any) => f.name === "Nachrichten").value).toBe("150");
    expect(ctx.store.get("ticket:transcript:t1")).toBe("150");
  });

  it("sendet beim Löschen nicht doppelt, wenn nichts Neues geschrieben wurde", async () => {
    const ctx = setup([fakeMessage(1, "42", "Hallo")]);
    await ctx.run();
    ctx.messages.push(fakeMessage(2, BOT, "Ticket #12 ist geschlossen."));
    await expect(ctx.run({ onlyIfChanged: true })).resolves.toBe("unchanged");
    expect(ctx.sent).toHaveLength(1);
  });

  it("sendet erneut, wenn nach dem Schließen noch jemand geschrieben hat", async () => {
    const ctx = setup([fakeMessage(1, "42", "Hallo")]);
    await ctx.run();
    ctx.messages.push(fakeMessage(2, "7", "Nachtrag vom Team"));
    await expect(ctx.run({ onlyIfChanged: true })).resolves.toBe("sent");
    expect(ctx.sent).toHaveLength(2);
  });

  it("sendet beim Löschen, wenn noch nie ein Protokoll gespeichert wurde", async () => {
    const ctx = setup([fakeMessage(1, "42", "Hallo")]);
    await expect(ctx.run({ onlyIfChanged: true })).resolves.toBe("sent");
  });

  it("macht ohne Log-Kanal nichts", async () => {
    const ctx = setup([fakeMessage(1, "42", "Hallo")]);
    await expect(ctx.run({ logChannelId: null })).resolves.toBe("no-log-channel");
    expect(ctx.sent).toHaveLength(0);
  });

  it("meldet fehlende Rechte im Log-Kanal verständlich und sendet nichts", async () => {
    const ctx = setup([fakeMessage(1, "42", "Hallo")], { missing: ["AttachFiles"] });
    await expect(ctx.run()).rejects.toBeInstanceOf(TranscriptError);
    expect(ctx.sent).toHaveLength(0);
    expect(ctx.store.size).toBe(0);
  });

  it("meldet einen nicht lesbaren Verlauf verständlich", async () => {
    const ctx = setup([], { failFetch: true });
    await expect(ctx.run()).rejects.toThrow(/Nachrichtenverlauf/);
  });
});
