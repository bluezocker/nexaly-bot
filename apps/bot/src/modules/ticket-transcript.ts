import { createLogger } from "@nexaly/logger";
import {
  renderTicketTranscript,
  type TranscriptAttachment,
  type TranscriptInput,
  type TranscriptMessage,
} from "@nexaly/shared";
import {
  AttachmentBuilder,
  PermissionFlagsBits,
  type Guild,
  type GuildTextBasedChannel,
  type Message,
  type User,
} from "discord.js";
import type Redis from "ioredis";

const log = createLogger("ticket-transcript");

/** Discord erlaubt Bots 10 MB pro Datei – mit etwas Abstand bleiben. */
export const MAX_FILE_BYTES = 9 * 1024 * 1024;
const MAX_MESSAGES = 2000;
const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const IMAGE_BUDGET_BYTES = 5 * 1024 * 1024;
const AVATAR_MAX_BYTES = 64 * 1024;
const AVATAR_MAX_COUNT = 50;
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const IMAGE_HOSTS = new Set(["cdn.discordapp.com", "media.discordapp.net"]);
const SENT_TTL_SEC = 180 * 24 * 3600;

/** Fehler mit einer Meldung, die dem Team direkt angezeigt werden kann. */
export class TranscriptError extends Error {}

export interface TicketRef {
  id: string;
  number: number;
  ownerId: string;
  createdAt: Date;
  closedAt: Date | null;
}

export type TranscriptResult = "sent" | "unchanged" | "no-log-channel";

const sentKey = (ticketId: string) => `ticket:transcript:${ticketId}`;

/**
 * ID der letzten Nachricht, die nicht vom Bot selbst stammt. Daran erkennt der Bot,
 * ob seit dem letzten Protokoll noch etwas geschrieben wurde.
 */
export function lastRelevantMessageId(messages: { id: string; authorId: string }[], botId: string): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message && message.authorId !== botId) return message.id;
  }
  return "none";
}

/** Kürzt so lange ältere Nachrichten weg, bis die Datei unter die Größengrenze passt. */
export function renderWithinLimit(input: TranscriptInput, maxBytes = MAX_FILE_BYTES): Buffer {
  let buffer = Buffer.from(renderTicketTranscript(input), "utf8");
  if (buffer.byteLength <= maxBytes) return buffer;

  // 1. Versuch: ohne eingebettete Bilder
  let messages = input.messages.map((message) => ({
    ...message,
    attachments: message.attachments?.map((attachment) => ({ ...attachment, dataUri: null })),
  }));
  buffer = Buffer.from(renderTicketTranscript({ ...input, messages }), "utf8");

  // 2. Versuch: älteste Hälfte weglassen, bis es passt
  while (buffer.byteLength > maxBytes && messages.length > 1) {
    messages = messages.slice(Math.ceil(messages.length / 2));
    buffer = Buffer.from(renderTicketTranscript({ ...input, messages, truncated: true }), "utf8");
  }
  return buffer;
}

async function collectMessages(channel: GuildTextBasedChannel): Promise<{ messages: Message[]; truncated: boolean }> {
  const all: Message[] = [];
  let before: string | undefined;
  let truncated = false;
  for (;;) {
    const batch = await channel.messages.fetch({ limit: 100, before });
    all.push(...batch.values());
    if (batch.size < 100) break;
    if (all.length >= MAX_MESSAGES) {
      truncated = true;
      break;
    }
    before = batch.last()?.id;
    if (!before) break;
  }
  all.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  return { messages: all, truncated };
}

/** Lädt ein Bild vom Discord-CDN und gibt es als data:-URI zurück (null, wenn es nicht passt). */
async function inlineImage(url: string, contentType: string | null, maxBytes: number): Promise<string | null> {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !IMAGE_HOSTS.has(parsed.hostname)) return null;
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return null;
    const type = (contentType ?? response.headers.get("content-type") ?? "").split(";")[0]?.trim() ?? "";
    if (!IMAGE_TYPES.has(type)) return null;
    if (Number(response.headers.get("content-length") ?? 0) > maxBytes) return null;
    const data = Buffer.from(await response.arrayBuffer());
    if (data.byteLength > maxBytes) return null;
    return `data:${type};base64,${data.toString("base64")}`;
  } catch {
    return null;
  }
}

async function toTranscriptMessages(messages: Message[]): Promise<TranscriptMessage[]> {
  let budget = IMAGE_BUDGET_BYTES;
  const result: TranscriptMessage[] = [];
  // Avatare einmal pro Person einbetten, damit das Protokoll ohne Discord vollständig bleibt.
  const avatars = new Map<string, string | null>();
  const avatarFor = async (message: Message): Promise<string | null> => {
    const cached = avatars.get(message.author.id);
    if (cached !== undefined) return cached;
    const url = message.author.displayAvatarURL({ extension: "png", size: 64 });
    const value = avatars.size < AVATAR_MAX_COUNT ? ((await inlineImage(url, null, AVATAR_MAX_BYTES)) ?? url) : url;
    avatars.set(message.author.id, value);
    return value;
  };
  for (const message of messages) {
    const attachments: TranscriptAttachment[] = [];
    for (const attachment of message.attachments.values()) {
      let dataUri: string | null = null;
      const type = (attachment.contentType ?? "").split(";")[0]?.trim() ?? "";
      if (IMAGE_TYPES.has(type) && attachment.size <= IMAGE_MAX_BYTES && attachment.size <= budget) {
        dataUri = await inlineImage(attachment.url, type, IMAGE_MAX_BYTES);
        if (dataUri) budget -= attachment.size;
      }
      attachments.push({ name: attachment.name, url: attachment.url, sizeBytes: attachment.size, dataUri });
    }
    const stickers = [...message.stickers.values()].map((sticker) => `[Sticker: ${sticker.name}]`).join(" ");
    const content = [message.cleanContent, stickers].filter(Boolean).join("\n");
    const embeds = message.embeds
      .map((embed) => ({
        title: embed.title,
        description: embed.description,
        fields: embed.fields.map((field) => ({ name: field.name, value: field.value })),
      }))
      .filter((embed) => embed.title || embed.description || embed.fields.length);
    if (!content && !embeds.length && !attachments.length) continue; // z. B. Systemmeldungen

    result.push({
      id: message.id,
      authorId: message.author.id,
      authorName: message.member?.displayName ?? message.author.displayName ?? message.author.username,
      authorAvatarUrl: await avatarFor(message),
      isBot: message.author.bot,
      timestamp: message.createdAt.toISOString(),
      edited: Boolean(message.editedTimestamp),
      content,
      embeds,
      attachments,
    });
  }
  return result;
}

async function resolveLogChannel(guild: Guild, logChannelId: string): Promise<GuildTextBasedChannel> {
  const channel = guild.channels.cache.get(logChannelId) ?? (await guild.channels.fetch(logChannelId).catch(() => null));
  if (!channel || !channel.isTextBased()) {
    throw new TranscriptError("Der eingestellte Log-Kanal existiert nicht mehr.");
  }
  const me = guild.members.me ?? (await guild.members.fetchMe());
  const missing = channel
    .permissionsFor(me)
    .missing([
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.AttachFiles,
    ]);
  if (missing.length) {
    throw new TranscriptError(
      "Mir fehlen im Log-Kanal Berechtigungen (Kanal ansehen, Nachrichten senden, Links einbetten, Dateien anhängen).",
    );
  }
  return channel;
}

/**
 * Erstellt das Protokoll eines Tickets und sendet es als HTML-Datei in den Log-Kanal.
 * Mit `onlyIfChanged` wird nichts gesendet, wenn seit dem letzten Protokoll keine
 * neue Nachricht dazugekommen ist (z. B. Löschen direkt nach dem Schließen).
 */
export async function saveTicketTranscript(input: {
  guild: Guild;
  channel: GuildTextBasedChannel;
  ticket: TicketRef;
  logChannelId: string | null;
  closedBy: User;
  redis: Redis;
  onlyIfChanged?: boolean;
}): Promise<TranscriptResult> {
  const { guild, channel, ticket } = input;
  if (!input.logChannelId) return "no-log-channel";
  const logChannel = await resolveLogChannel(guild, input.logChannelId);

  let collected: Awaited<ReturnType<typeof collectMessages>>;
  try {
    collected = await collectMessages(channel);
  } catch (error) {
    log.error({ err: error, guildId: guild.id, channelId: channel.id }, "reading ticket messages failed");
    throw new TranscriptError("Ich kann den Nachrichtenverlauf dieses Tickets nicht lesen (Berechtigung Nachrichtenverlauf lesen).");
  }

  const botId = guild.client.user.id;
  const lastId = lastRelevantMessageId(
    collected.messages.map((message) => ({ id: message.id, authorId: message.author.id })),
    botId,
  );
  if (input.onlyIfChanged) {
    const previous = await input.redis.get(sentKey(ticket.id)).catch(() => null);
    if (previous && previous === lastId) return "unchanged";
  }

  const messages = await toTranscriptMessages(collected.messages);
  const owner = await guild.members.fetch(ticket.ownerId).catch(() => null);
  const ownerName =
    owner?.displayName ??
    messages.find((message) => message.authorId === ticket.ownerId)?.authorName ??
    `Nutzer ${ticket.ownerId}`;
  const closedByMember = await guild.members.fetch(input.closedBy.id).catch(() => null);

  const buffer = renderWithinLimit({
    guildName: guild.name,
    ticketNumber: ticket.number,
    ownerName,
    ownerId: ticket.ownerId,
    openedAt: ticket.createdAt.toISOString(),
    closedAt: (ticket.closedAt ?? new Date()).toISOString(),
    closedByName: closedByMember?.displayName ?? input.closedBy.displayName ?? input.closedBy.username,
    messages,
    truncated: collected.truncated,
  });

  const participants = [...new Set(messages.filter((message) => !message.isBot).map((message) => message.authorId))];
  const shown = participants.slice(0, 15).map((id) => `<@${id}>`);
  if (participants.length > shown.length) shown.push(`+${participants.length - shown.length}`);

  await logChannel.send({
    embeds: [
      {
        title: `Ticket #${ticket.number} – Protokoll`,
        color: 0x7c5cff,
        fields: [
          { name: "Erstellt von", value: `<@${ticket.ownerId}>`, inline: true },
          { name: "Geschlossen von", value: `<@${input.closedBy.id}>`, inline: true },
          { name: "Nachrichten", value: String(messages.length), inline: true },
          { name: "Beteiligte", value: shown.join(" ") || "–" },
        ],
        footer: { text: "Datei herunterladen und im Browser öffnen" },
      },
    ],
    files: [new AttachmentBuilder(buffer, { name: `ticket-${String(ticket.number).padStart(4, "0")}.html` })],
    allowedMentions: { parse: [] },
  });

  await input.redis.set(sentKey(ticket.id), lastId, "EX", SENT_TTL_SEC).catch(() => undefined);
  return "sent";
}
