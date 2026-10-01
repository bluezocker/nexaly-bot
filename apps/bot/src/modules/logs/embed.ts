import { EmbedBuilder, type ColorResolvable } from "discord.js";
import {
  DISCORD_EMBED_DESCRIPTION_LIMIT,
  DISCORD_EMBED_FIELD_LIMIT,
  truncateEmbed,
  type LogEventKey,
} from "@nexaly/shared";

const COLORS: Record<string, ColorResolvable> = {
  messages: 0xf0b232,
  members: 0x5ee2a0,
  moderation: 0xf07178,
  roles: 0x7c5cff,
  channels: 0x38bdf8,
  voice: 0x22d3ee,
};

const GROUP: Record<LogEventKey, keyof typeof COLORS> = {
  messageDelete: "messages",
  messageUpdate: "messages",
  memberJoin: "members",
  memberLeave: "members",
  nicknameUpdate: "members",
  banAdd: "moderation",
  banRemove: "moderation",
  kick: "moderation",
  timeout: "moderation",
  botModeration: "moderation",
  memberRoleUpdate: "roles",
  roleCreate: "roles",
  roleDelete: "roles",
  channelCreate: "channels",
  channelDelete: "channels",
  channelUpdate: "channels",
  voiceJoin: "voice",
  voiceLeave: "voice",
  voiceMove: "voice",
};

export function logEmbed(input: {
  key: LogEventKey;
  title: string;
  description?: string;
  fields?: { name: string; value: string; inline?: boolean }[];
  actorId?: string | null;
}): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(COLORS[GROUP[input.key]] ?? 0x7c5cff)
    .setTitle(input.title)
    .setTimestamp(new Date())
    .setFooter({ text: `Nexaly · ${input.key}` });

  if (input.description) {
    embed.setDescription(truncateEmbed(input.description, DISCORD_EMBED_DESCRIPTION_LIMIT));
  }

  for (const field of input.fields ?? []) {
    embed.addFields({
      name: truncateEmbed(field.name, 256),
      value: truncateEmbed(field.value || "—", DISCORD_EMBED_FIELD_LIMIT),
      inline: field.inline ?? false,
    });
  }

  if (input.actorId) {
    embed.addFields({ name: "Ausgeführt von", value: `<@${input.actorId}> \`${input.actorId}\`` });
  }

  return embed;
}

export function mentionUser(id: string, tag?: string | null): string {
  return tag ? `<@${id}> (${tag})` : `<@${id}>`;
}
