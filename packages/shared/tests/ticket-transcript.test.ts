import { describe, expect, it } from "vitest";
import { formatTranscriptContent, renderTicketTranscript, type TranscriptInput } from "../src/index.js";

const base: TranscriptInput = {
  guildName: "Test <Server>",
  ticketNumber: 7,
  ownerName: "Ben",
  ownerId: "1",
  openedAt: "2026-10-01T10:00:00.000Z",
  closedAt: "2026-10-01T11:30:00.000Z",
  closedByName: "Mod",
  messages: [],
};

const msg = (content: string, extra: Partial<TranscriptInput["messages"][number]> = {}) => ({
  id: "100",
  authorId: "1",
  authorName: "Ben",
  isBot: false,
  timestamp: "2026-10-01T10:05:00.000Z",
  content,
  ...extra,
});

describe("formatTranscriptContent", () => {
  it("maskiert HTML", () => {
    const html = formatTranscriptContent(`<script>alert("x")</script><img src=x onerror=alert(1)>`);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
  });

  it("verlinkt nur http(s)-Adressen und maskiert sie", () => {
    const html = formatTranscriptContent(`siehe https://example.com/a?b=1&c=2. und javascript:alert(1)`);
    expect(html).toContain('<a href="https://example.com/a?b=1&amp;c=2"');
    expect(html).toContain("</a>.");
    expect(html).not.toContain('href="javascript');
  });

  it("lässt sich über Links nicht aus dem Attribut ausbrechen", () => {
    const html = formatTranscriptContent(`https://x.de/"onmouseover="alert(1)`);
    expect(html).not.toMatch(/<a [^>]*onmouseover/);
  });

  it("stellt Code, Fett und Zeilenumbrüche dar", () => {
    expect(formatTranscriptContent("**fett** und `a<b`\nneu")).toBe(
      "<strong>fett</strong> und <code>a&lt;b</code><br>neu",
    );
    expect(formatTranscriptContent("```js\nconst a = '<b>';\n```")).toBe(
      "<pre>const a = &#39;&lt;b&gt;&#39;;</pre>",
    );
  });

  it("wendet Markdown nicht innerhalb von Code oder Links an", () => {
    expect(formatTranscriptContent("`**x**`")).toBe("<code>**x**</code>");
    expect(formatTranscriptContent("https://x.de/a**b**c")).not.toContain("<strong>");
  });

  it("zeigt Server-Emojis als Kurznamen", () => {
    expect(formatTranscriptContent("hi <:wave:123456789012345678> <a:party:123456789012345678>")).toBe(
      "hi :wave: :party:",
    );
  });
});

describe("renderTicketTranscript", () => {
  it("enthält Kopfdaten und maskiert Namen", () => {
    const html = renderTicketTranscript({
      ...base,
      messages: [msg("Hallo", { authorName: `<b onclick="x">Evil</b>` })],
    });
    expect(html).toContain("Ticket #7");
    expect(html).toContain("Test &lt;Server&gt;");
    expect(html).not.toContain("<b onclick");
    expect(html).toContain("01.10.2026, 12:05"); // Europe/Berlin
    expect(html).toContain("Content-Security-Policy");
    expect(html).not.toContain("<script");
  });

  it("bettet nur gültige Bild-Daten ein", () => {
    const html = renderTicketTranscript({
      ...base,
      messages: [
        msg("", {
          attachments: [
            { name: "ok.png", url: "https://cdn.discordapp.com/a/ok.png", sizeBytes: 10, dataUri: "data:image/png;base64,AAAA" },
            { name: "bad.svg", url: "https://x/bad.svg", sizeBytes: 10, dataUri: 'data:image/svg+xml;base64,AAAA" onload="x' },
            { name: "log.txt", url: "https://x/log.txt", sizeBytes: 2048 },
          ],
        }),
      ],
    });
    expect(html).toContain('<img src="data:image/png;base64,AAAA" alt="ok.png">');
    expect(html).not.toContain("svg+xml");
    expect(html).toContain("log.txt");
    expect(html).toContain("2 KB");
  });

  it("verwendet nur Discord-Avatare", () => {
    const good = renderTicketTranscript({
      ...base,
      messages: [msg("a", { authorAvatarUrl: "https://cdn.discordapp.com/avatars/1/abc.png?size=64" })],
    });
    const bad = renderTicketTranscript({
      ...base,
      messages: [msg("a", { authorAvatarUrl: 'https://evil.example/x.png" onerror="alert(1)' })],
    });
    expect(good).toContain('src="https://cdn.discordapp.com/avatars/1/abc.png?size=64"');
    expect(bad).not.toContain("evil.example");
  });

  it("weist auf gekürzte und leere Protokolle hin", () => {
    expect(renderTicketTranscript({ ...base, truncated: true, messages: [msg("x")] })).toContain("gekürzt");
    expect(renderTicketTranscript(base)).toContain("keine Nachrichten");
  });

  it("stellt Embeds dar", () => {
    const html = renderTicketTranscript({
      ...base,
      messages: [msg("", { isBot: true, embeds: [{ title: "Ticket #7", description: "Beschreibe <dein> Anliegen", fields: [{ name: "A", value: "B" }] }] })],
    });
    expect(html).toContain("Beschreibe &lt;dein&gt; Anliegen");
    expect(html).toContain('<span class="tag">BOT</span>');
  });
});
