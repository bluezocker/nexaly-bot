/**
 * Baut aus den Nachrichten eines Tickets eine eigenständige HTML-Datei.
 *
 * Wichtig: Alle Inhalte stammen von Nutzern und die Datei wird vom Team im Browser
 * geöffnet. Deshalb wird alles maskiert, es gibt kein JavaScript, und eine
 * Content-Security-Policy lässt nur eingebettete Bilder und Discord-Avatare zu.
 */

export interface TranscriptAttachment {
  name: string;
  url: string;
  sizeBytes: number;
  /** Eingebettetes Bild (data:image/...;base64,...), falls vorhanden. */
  dataUri?: string | null;
}

export interface TranscriptEmbed {
  title?: string | null;
  description?: string | null;
  fields?: { name: string; value: string }[];
}

export interface TranscriptMessage {
  id: string;
  authorId: string;
  authorName: string;
  /** Discord-CDN-Adresse oder eingebettetes Bild (data:image/...;base64,...) */
  authorAvatarUrl?: string | null;
  isBot: boolean;
  /** ISO-Zeitstempel */
  timestamp: string;
  edited?: boolean;
  content: string;
  embeds?: TranscriptEmbed[];
  attachments?: TranscriptAttachment[];
}

export interface TranscriptInput {
  guildName: string;
  ticketNumber: number;
  ownerName: string;
  ownerId: string;
  openedAt: string;
  closedAt?: string | null;
  closedByName?: string | null;
  messages: TranscriptMessage[];
  /** true, wenn ältere Nachrichten wegen der Größenbegrenzung fehlen */
  truncated?: boolean;
  timeZone?: string;
}

const IMAGE_DATA_URI = /^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+=*$/;
const AVATAR_URL = /^https:\/\/cdn\.discordapp\.com\/[\w\-./]+(?:\?[\w=&]*)?$/;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inlineMarkdown(escaped: string): string {
  return escaped
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_\n]+)__/g, "<u>$1</u>")
    .replace(/~~([^~\n]+)~~/g, "<s>$1</s>")
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
}

/** Text außerhalb von Code: Links erkennen, Rest maskieren und leichtes Markdown anwenden. */
function formatPlain(raw: string): string {
  const parts = raw.split(/(https?:\/\/[^\s<>"'`]+)/g);
  return parts
    .map((part, index) => {
      if (index % 2 === 0) return inlineMarkdown(escapeHtml(part));
      // Satzzeichen am Ende gehören meist nicht zum Link
      const trailing = /[.,!?;:)\]]+$/.exec(part)?.[0] ?? "";
      const url = trailing ? part.slice(0, -trailing.length) : part;
      const safe = escapeHtml(url);
      return `<a href="${safe}" rel="noopener noreferrer nofollow" target="_blank">${safe}</a>${escapeHtml(trailing)}`;
    })
    .join("");
}

/** Wandelt Discord-Text in sicheres HTML um (Codeblöcke, Inline-Code, Links, fett/kursiv). */
export function formatTranscriptContent(raw: string): string {
  const text = raw.replace(/<a?:(\w{1,32}):\d{5,25}>/g, ":$1:");
  const blocks = text.split(/```(?:[\w+#-]{0,20}\n)?([\s\S]*?)```/g);
  return blocks
    .map((block, index) => {
      if (index % 2 === 1) return `<pre>${escapeHtml(block.replace(/\n$/, ""))}</pre>`;
      const inline = block.split(/`([^`\n]+)`/g);
      return inline
        .map((piece, i) => (i % 2 === 1 ? `<code>${escapeHtml(piece)}</code>` : formatPlain(piece)))
        .join("")
        .replace(/\n/g, "<br>");
    })
    .join("");
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function renderAttachment(attachment: TranscriptAttachment): string {
  const name = escapeHtml(attachment.name);
  if (attachment.dataUri && IMAGE_DATA_URI.test(attachment.dataUri)) {
    return `<figure class="img"><img src="${attachment.dataUri}" alt="${name}"><figcaption>${name}</figcaption></figure>`;
  }
  return `<div class="file">📎 ${name} <span class="muted">(${formatBytes(attachment.sizeBytes)}, nicht im Protokoll gespeichert)</span></div>`;
}

function renderEmbed(embed: TranscriptEmbed): string {
  const parts: string[] = [];
  if (embed.title) parts.push(`<div class="embed-title">${formatTranscriptContent(embed.title)}</div>`);
  if (embed.description) parts.push(`<div>${formatTranscriptContent(embed.description)}</div>`);
  for (const field of embed.fields ?? []) {
    parts.push(
      `<div class="embed-field"><div class="embed-name">${formatTranscriptContent(field.name)}</div><div>${formatTranscriptContent(field.value)}</div></div>`,
    );
  }
  return parts.length ? `<div class="embed">${parts.join("")}</div>` : "";
}

function initial(name: string): string {
  return escapeHtml((Array.from(name.trim())[0] ?? "?").toUpperCase());
}

export function renderTicketTranscript(input: TranscriptInput): string {
  const timeZone = input.timeZone ?? "Europe/Berlin";
  const dateTime = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short", timeZone });
  const fmt = (iso: string | null | undefined) => {
    if (!iso) return "–";
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? "–" : dateTime.format(date);
  };

  const participants = new Map<string, string>();
  for (const message of input.messages) {
    if (!message.isBot) participants.set(message.authorId, message.authorName);
  }

  const rows = input.messages
    .map((message) => {
      const avatar =
        message.authorAvatarUrl &&
        (AVATAR_URL.test(message.authorAvatarUrl) || IMAGE_DATA_URI.test(message.authorAvatarUrl))
          ? `<img class="avatar" src="${escapeHtml(message.authorAvatarUrl)}" alt="" loading="lazy">`
          : `<div class="avatar ph">${initial(message.authorName)}</div>`;
      const body = [
        message.content ? `<div class="content">${formatTranscriptContent(message.content)}</div>` : "",
        ...(message.embeds ?? []).map(renderEmbed),
        ...(message.attachments ?? []).map(renderAttachment),
      ].join("");
      return `<article class="msg">${avatar}<div class="body"><header><span class="author${
        message.authorId === input.ownerId ? " owner" : ""
      }">${escapeHtml(message.authorName)}</span>${message.isBot ? '<span class="tag">BOT</span>' : ""}<time>${fmt(
        message.timestamp,
      )}</time>${message.edited ? '<span class="muted">(bearbeitet)</span>' : ""}</header>${body}</div></article>`;
    })
    .join("\n");

  const title = `Ticket #${input.ticketNumber} – ${input.guildName}`;
  const meta: [string, string][] = [
    ["Erstellt von", input.ownerName],
    ["Geöffnet", fmt(input.openedAt)],
    ["Geschlossen", fmt(input.closedAt)],
    ["Geschlossen von", input.closedByName ?? "–"],
    ["Nachrichten", String(input.messages.length)],
    ["Beteiligte", [...participants.values()].join(", ") || "–"],
  ];

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https://cdn.discordapp.com; style-src 'unsafe-inline'">
<meta name="referrer" content="no-referrer">
<title>${escapeHtml(title)}</title>
<style>
:root{color-scheme:dark;--bg:#0f1117;--panel:#171a23;--border:#262b38;--text:#e6e8ee;--muted:#8b93a7;--accent:#7c5cff}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:860px;margin:0 auto;padding:24px 16px 48px}
h1{font-size:22px;margin:0 0 4px}
.sub{color:var(--muted);margin:0 0 16px}
dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px 16px;margin:0 0 24px;padding:16px;background:var(--panel);border:1px solid var(--border);border-radius:12px}
dt{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.04em}
dd{margin:0;overflow-wrap:anywhere}
.note{padding:10px 14px;margin:0 0 16px;border:1px solid var(--border);border-left:3px solid var(--accent);border-radius:8px;color:var(--muted)}
.msg{display:flex;gap:12px;padding:10px 0;border-top:1px solid var(--border)}
.avatar{width:40px;height:40px;border-radius:50%;flex:none;background:var(--panel)}
.avatar.ph{display:grid;place-items:center;font-weight:600;color:var(--muted)}
.body{min-width:0;flex:1}
header{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px}
.author{font-weight:600}
.author.owner{color:var(--accent)}
.tag{font-size:10px;font-weight:700;background:var(--accent);color:#fff;border-radius:4px;padding:1px 5px}
time,.muted{color:var(--muted);font-size:12px}
.content{overflow-wrap:anywhere}
a{color:#8fb4ff}
code,pre{font:13px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:#0b0d12;border:1px solid var(--border);border-radius:6px}
code{padding:1px 5px}
pre{padding:10px 12px;margin:6px 0;overflow-x:auto;white-space:pre-wrap;overflow-wrap:anywhere}
.embed{margin:6px 0;padding:10px 12px;background:var(--panel);border:1px solid var(--border);border-left:3px solid var(--accent);border-radius:8px;overflow-wrap:anywhere}
.embed-title,.embed-name{font-weight:600}
.embed-field{margin-top:8px}
.file{margin:6px 0;padding:8px 12px;background:var(--panel);border:1px solid var(--border);border-radius:8px;overflow-wrap:anywhere}
figure.img{margin:6px 0}
figure.img img{max-width:100%;max-height:480px;border-radius:8px;border:1px solid var(--border);display:block}
figcaption{color:var(--muted);font-size:12px;margin-top:4px;overflow-wrap:anywhere}
footer{margin-top:24px;color:var(--muted);font-size:12px;text-align:center}
</style>
</head>
<body>
<main>
<h1>Ticket #${input.ticketNumber}</h1>
<p class="sub">${escapeHtml(input.guildName)}</p>
<dl>
${meta.map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("\n")}
</dl>
${input.truncated ? '<p class="note">Dieses Protokoll ist gekürzt: Ältere Nachrichten fehlen, weil das Ticket zu groß war.</p>' : ""}
${rows || '<p class="note">In diesem Ticket wurden keine Nachrichten geschrieben.</p>'}
<footer>Protokoll erstellt von Nexaly · Zeiten in ${escapeHtml(timeZone)}</footer>
</main>
</body>
</html>
`;
}
