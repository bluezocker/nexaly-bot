import {
  AuditLogEvent,
  type Client,
  type Guild,
  type GuildMember,
  type Message,
  type PartialMessage,
  type Role,
  type GuildChannel,
  type VoiceState,
  type NonThreadGuildBasedChannel,
} from "discord.js";
import { emitLog } from "./emit.js";
import { getLogConfig, isEventEnabled } from "./config.js";
import { resolveAuditExecutor } from "./audit.js";
import { logEmbed, mentionUser } from "./embed.js";

function tag(user: { username: string; discriminator?: string } | null | undefined): string | null {
  if (!user) return null;
  return user.username;
}

function contentOf(message: Message | PartialMessage): string {
  if (message.partial) return "*Inhalt nicht im Cache*";
  return message.content?.length ? message.content : "*kein Text*";
}

export function bindLogEvents(client: Client): void {
  client.on("messageDelete", async (message) => {
    if (!message.guild) return;
    if (message.author?.bot) return;
    const config = await getLogConfig(message.guild.id);
    const channelId = isEventEnabled(config, "messageDelete");
    if (!channelId) return;
    if (message.channelId === channelId) return;

    const embed = logEmbed({
      key: "messageDelete",
      title: "Nachricht gelöscht",
      fields: [
        { name: "Autor", value: message.author ? mentionUser(message.author.id, tag(message.author)) : "unbekannt" },
        { name: "Kanal", value: `<#${message.channelId}>` },
        { name: "Inhalt", value: contentOf(message) },
      ],
    });

    await emitLog({
      client,
      guild: message.guild,
      key: "messageDelete",
      embed,
      storeMessageContent: true,
      payload: {
        authorId: message.author?.id ?? null,
        channelId: message.channelId,
        content: contentOf(message),
      },
    });
  });

  client.on("messageUpdate", async (before, after) => {
    if (!after.guild) return;
    if (after.author?.bot) return;
    const beforeContent = before.partial ? null : before.content;
    const afterContent = after.partial ? after.content : after.content;
    if (beforeContent === afterContent) return;

    const config = await getLogConfig(after.guild.id);
    const channelId = isEventEnabled(config, "messageUpdate");
    if (!channelId) return;
    if (after.channelId === channelId) return;

    const embed = logEmbed({
      key: "messageUpdate",
      title: "Nachricht bearbeitet",
      fields: [
        { name: "Autor", value: after.author ? mentionUser(after.author.id, tag(after.author)) : "unbekannt" },
        { name: "Kanal", value: `<#${after.channelId}>` },
        { name: "Vorher", value: beforeContent ?? "*nicht im Cache*" },
        { name: "Nachher", value: afterContent ?? "*nicht im Cache*" },
      ],
    });

    await emitLog({
      client,
      guild: after.guild,
      key: "messageUpdate",
      embed,
      storeMessageContent: true,
      payload: {
        authorId: after.author?.id ?? null,
        channelId: after.channelId,
        before: beforeContent,
        after: afterContent,
      },
    });
  });

  client.on("guildMemberAdd", async (member) => {
    const embed = logEmbed({
      key: "memberJoin",
      title: "Mitglied beigetreten",
      fields: [
        { name: "Mitglied", value: mentionUser(member.id, tag(member.user)) },
        { name: "Account erstellt", value: member.user.createdAt.toISOString() },
      ],
    });
    await emitLog({
      client,
      guild: member.guild,
      key: "memberJoin",
      embed,
      payload: { userId: member.id },
    });
  });

  client.on("guildMemberRemove", async (member) => {
    const guild = member.guild;
    const kickActor = await resolveAuditExecutor(guild, AuditLogEvent.MemberKick, member.id);
    if (kickActor) {
      const embed = logEmbed({
        key: "kick",
        title: "Mitglied gekickt",
        fields: [{ name: "Mitglied", value: mentionUser(member.id, tag(member.user)) }],
        actorId: kickActor,
      });
      await emitLog({
        client,
        guild,
        key: "kick",
        embed,
        actorId: kickActor,
        payload: { userId: member.id },
      });
      return;
    }

    const embed = logEmbed({
      key: "memberLeave",
      title: "Mitglied verlassen",
      fields: [{ name: "Mitglied", value: mentionUser(member.id, tag(member.user)) }],
    });
    await emitLog({
      client,
      guild,
      key: "memberLeave",
      embed,
      payload: { userId: member.id },
    });
  });

  client.on("guildBanAdd", async (ban) => {
    const actorId = await resolveAuditExecutor(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);
    const embed = logEmbed({
      key: "banAdd",
      title: "Mitglied gebannt",
      fields: [
        { name: "Mitglied", value: mentionUser(ban.user.id, tag(ban.user)) },
        { name: "Grund", value: ban.reason ?? "—" },
      ],
      actorId,
    });
    await emitLog({
      client,
      guild: ban.guild,
      key: "banAdd",
      embed,
      actorId,
      payload: { userId: ban.user.id, reason: ban.reason ?? null },
    });
  });

  client.on("guildBanRemove", async (ban) => {
    const actorId = await resolveAuditExecutor(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id);
    const embed = logEmbed({
      key: "banRemove",
      title: "Ban aufgehoben",
      fields: [{ name: "Mitglied", value: mentionUser(ban.user.id, tag(ban.user)) }],
      actorId,
    });
    await emitLog({
      client,
      guild: ban.guild,
      key: "banRemove",
      embed,
      actorId,
      payload: { userId: ban.user.id },
    });
  });

  client.on("guildMemberUpdate", async (before, after) => {
    await handleNickname(client, before, after);
    await handleTimeout(client, before, after);
    await handleRoles(client, before, after);
  });

  client.on("channelCreate", async (channel) => {
    if (!("guild" in channel) || !channel.guild) return;
    const guildChannel = channel as GuildChannel;
    const actorId = await resolveAuditExecutor(
      guildChannel.guild,
      AuditLogEvent.ChannelCreate,
      guildChannel.id,
    );
    const embed = logEmbed({
      key: "channelCreate",
      title: "Kanal erstellt",
      fields: [{ name: "Kanal", value: `${guildChannel.name} \`${guildChannel.id}\`` }],
      actorId,
    });
    await emitLog({
      client,
      guild: guildChannel.guild,
      key: "channelCreate",
      embed,
      actorId,
      payload: { channelId: guildChannel.id, name: guildChannel.name },
    });
  });

  client.on("channelDelete", async (channel) => {
    if (!("guild" in channel) || !channel.guild) return;
    const guildChannel = channel as GuildChannel;
    const actorId = await resolveAuditExecutor(
      guildChannel.guild,
      AuditLogEvent.ChannelDelete,
      guildChannel.id,
    );
    const embed = logEmbed({
      key: "channelDelete",
      title: "Kanal gelöscht",
      fields: [{ name: "Kanal", value: `${guildChannel.name} \`${guildChannel.id}\`` }],
      actorId,
    });
    await emitLog({
      client,
      guild: guildChannel.guild,
      key: "channelDelete",
      embed,
      actorId,
      payload: { channelId: guildChannel.id, name: guildChannel.name },
    });
  });

  client.on("channelUpdate", async (before, after) => {
    if (!("guild" in after) || !after.guild) return;
    const prev = before as NonThreadGuildBasedChannel;
    const next = after as NonThreadGuildBasedChannel;
    const changes: string[] = [];
    if ("name" in prev && "name" in next && prev.name !== next.name) {
      changes.push(`Name: \`${prev.name}\` → \`${next.name}\``);
    }
    if ("topic" in prev && "topic" in next && prev.topic !== next.topic) {
      changes.push("Thema geändert");
    }
    if (changes.length === 0) return;

    const actorId = await resolveAuditExecutor(next.guild, AuditLogEvent.ChannelUpdate, next.id);
    const embed = logEmbed({
      key: "channelUpdate",
      title: "Kanal geändert",
      fields: [
        { name: "Kanal", value: `<#${next.id}>` },
        { name: "Änderungen", value: changes.join("\n") },
      ],
      actorId,
    });
    await emitLog({
      client,
      guild: next.guild,
      key: "channelUpdate",
      embed,
      actorId,
      payload: { channelId: next.id, changes },
    });
  });

  client.on("roleCreate", async (role) => {
    const actorId = await resolveAuditExecutor(role.guild, AuditLogEvent.RoleCreate, role.id);
    const embed = logEmbed({
      key: "roleCreate",
      title: "Rolle erstellt",
      fields: [{ name: "Rolle", value: `${role.name} \`${role.id}\`` }],
      actorId,
    });
    await emitLog({
      client,
      guild: role.guild,
      key: "roleCreate",
      embed,
      actorId,
      payload: { roleId: role.id, name: role.name },
    });
  });

  client.on("roleDelete", async (role: Role) => {
    const actorId = await resolveAuditExecutor(role.guild, AuditLogEvent.RoleDelete, role.id);
    const embed = logEmbed({
      key: "roleDelete",
      title: "Rolle gelöscht",
      fields: [{ name: "Rolle", value: `${role.name} \`${role.id}\`` }],
      actorId,
    });
    await emitLog({
      client,
      guild: role.guild,
      key: "roleDelete",
      embed,
      actorId,
      payload: { roleId: role.id, name: role.name },
    });
  });

  client.on("voiceStateUpdate", async (before: VoiceState, after: VoiceState) => {
    const guild = after.guild ?? before.guild;
    const member = after.member ?? before.member;
    if (!member) return;

    if (!before.channelId && after.channelId) {
      const embed = logEmbed({
        key: "voiceJoin",
        title: "Voice beigetreten",
        fields: [
          { name: "Mitglied", value: mentionUser(member.id, tag(member.user)) },
          { name: "Kanal", value: `<#${after.channelId}>` },
        ],
      });
      await emitLog({
        client,
        guild,
        key: "voiceJoin",
        embed,
        payload: { userId: member.id, channelId: after.channelId },
      });
      return;
    }

    if (before.channelId && !after.channelId) {
      const embed = logEmbed({
        key: "voiceLeave",
        title: "Voice verlassen",
        fields: [
          { name: "Mitglied", value: mentionUser(member.id, tag(member.user)) },
          { name: "Kanal", value: `<#${before.channelId}>` },
        ],
      });
      await emitLog({
        client,
        guild,
        key: "voiceLeave",
        embed,
        payload: { userId: member.id, channelId: before.channelId },
      });
      return;
    }

    if (before.channelId && after.channelId && before.channelId !== after.channelId) {
      const embed = logEmbed({
        key: "voiceMove",
        title: "Voice-Kanal gewechselt",
        fields: [
          { name: "Mitglied", value: mentionUser(member.id, tag(member.user)) },
          { name: "Von", value: `<#${before.channelId}>` },
          { name: "Nach", value: `<#${after.channelId}>` },
        ],
      });
      await emitLog({
        client,
        guild,
        key: "voiceMove",
        embed,
        payload: {
          userId: member.id,
          from: before.channelId,
          to: after.channelId,
        },
      });
    }
  });
}

async function handleNickname(
  client: Client,
  before: GuildMember | import("discord.js").PartialGuildMember,
  after: GuildMember,
): Promise<void> {
  const prev = before.nickname ?? before.user.username;
  const next = after.nickname ?? after.user.username;
  if (prev === next) return;
  const actorId = await resolveAuditExecutor(after.guild, AuditLogEvent.MemberUpdate, after.id);
  const embed = logEmbed({
    key: "nicknameUpdate",
    title: "Nickname geändert",
    fields: [
      { name: "Mitglied", value: mentionUser(after.id, tag(after.user)) },
      { name: "Vorher", value: prev },
      { name: "Nachher", value: next },
    ],
    actorId,
  });
  await emitLog({
    client,
    guild: after.guild,
    key: "nicknameUpdate",
    embed,
    actorId,
    payload: { userId: after.id, before: prev, after: next },
  });
}

async function handleTimeout(
  client: Client,
  before: GuildMember | import("discord.js").PartialGuildMember,
  after: GuildMember,
): Promise<void> {
  const prev = before.communicationDisabledUntilTimestamp ?? null;
  const next = after.communicationDisabledUntilTimestamp ?? null;
  if (prev === next) return;
  const actorId = await resolveAuditExecutor(after.guild, AuditLogEvent.MemberUpdate, after.id);
  const active = next !== null && next > Date.now();
  const embed = logEmbed({
    key: "timeout",
    title: active ? "Timeout gesetzt" : "Timeout aufgehoben",
    fields: [
      { name: "Mitglied", value: mentionUser(after.id, tag(after.user)) },
      { name: "Bis", value: active && after.communicationDisabledUntil ? after.communicationDisabledUntil.toISOString() : "—" },
    ],
    actorId,
  });
  await emitLog({
    client,
    guild: after.guild,
    key: "timeout",
    embed,
    actorId,
    payload: { userId: after.id, until: next },
  });
}

async function handleRoles(
  client: Client,
  before: GuildMember | import("discord.js").PartialGuildMember,
  after: GuildMember,
): Promise<void> {
  if (!("roles" in before)) return;
  const added = after.roles.cache.filter((role) => !before.roles.cache.has(role.id));
  const removed = before.roles.cache.filter((role) => !after.roles.cache.has(role.id));
  if (added.size === 0 && removed.size === 0) return;

  const actorId = await resolveAuditExecutor(after.guild, AuditLogEvent.MemberRoleUpdate, after.id);
  const fields = [
    { name: "Mitglied", value: mentionUser(after.id, tag(after.user)) },
  ];
  if (added.size) {
    fields.push({ name: "Hinzugefügt", value: added.map((role) => `<@&${role.id}>`).join(", ") });
  }
  if (removed.size) {
    fields.push({ name: "Entfernt", value: removed.map((role) => `<@&${role.id}>`).join(", ") });
  }
  const embed = logEmbed({
    key: "memberRoleUpdate",
    title: "Rollen geändert",
    fields,
    actorId,
  });
  await emitLog({
    client,
    guild: after.guild,
    key: "memberRoleUpdate",
    embed,
    actorId,
    payload: {
      userId: after.id,
      added: [...added.keys()],
      removed: [...removed.keys()],
    },
  });
}

export async function emitBotModerationLog(input: {
  client: Client;
  guild: Guild;
  action: string;
  targetId: string;
  reason?: string | null;
  moderatorId: string;
}): Promise<void> {
  const embed = logEmbed({
    key: "botModeration",
    title: `Bot-Moderation: ${input.action}`,
    fields: [
      { name: "Ziel", value: mentionUser(input.targetId) },
      { name: "Grund", value: input.reason ?? "—" },
    ],
    actorId: input.moderatorId,
  });
  await emitLog({
    client: input.client,
    guild: input.guild,
    key: "botModeration",
    embed,
    actorId: input.moderatorId,
    payload: {
      action: input.action,
      targetId: input.targetId,
      reason: input.reason ?? null,
    },
  });
}
