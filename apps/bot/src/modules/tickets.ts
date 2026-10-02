import { prisma } from "@nexaly/database";
import { createLogger } from "@nexaly/logger";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Events,
  PermissionFlagsBits,
  type ButtonInteraction,
  type Client,
  type Guild,
  type GuildMember,
  type TextChannel,
} from "discord.js";
import type Redis from "ioredis";
import { saveTicketTranscript, TranscriptError } from "./ticket-transcript.js";

const log = createLogger("tickets");

// Tickets, für die gerade ein Protokoll erstellt wird (verhindert doppelte Protokolle bei Doppelklick).
const busyChannels = new Set<string>();

function transcriptProblem(error: unknown): string {
  return error instanceof TranscriptError ? error.message : "Unerwarteter Fehler, Details stehen im Bot-Log.";
}

function staff(member: GuildMember, staffRoleId: string | null): boolean {
  if (member.permissions.has(PermissionFlagsBits.ManageChannels)) return true;
  return Boolean(staffRoleId && member.roles.cache.has(staffRoleId));
}

// Ticket-Öffnungen pro Server nacheinander abarbeiten. Sonst erzeugen Doppelklicks
// zwei Kanäle bzw. zwei gleichzeitige Nutzer dieselbe Ticketnummer.
const guildQueues = new Map<string, Promise<void>>();

function withGuildLock(guildId: string, task: () => Promise<void>): Promise<void> {
  const previous = guildQueues.get(guildId) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(task);
  guildQueues.set(guildId, next);
  return next.finally(() => {
    if (guildQueues.get(guildId) === next) guildQueues.delete(guildId);
  });
}

async function openTicket(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guild || !interaction.guildId) return;
  await interaction.deferReply({ ephemeral: true });
  await withGuildLock(interaction.guildId, () => openTicketLocked(interaction));
}

async function openTicketLocked(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guild || !interaction.guildId) return;
  const settings = await prisma.ticketSettings.findUnique({ where: { guildId: interaction.guildId } });
  if (!settings?.enabled || !settings.categoryId || !settings.staffRoleId) {
    await interaction.editReply("Tickets sind auf diesem Server nicht eingerichtet.");
    return;
  }
  const guild = interaction.guild;
  const existing = await prisma.ticket.findFirst({
    where: { guildId: guild.id, ownerId: interaction.user.id, status: "open" },
  });
  if (existing) {
    const channel = guild.channels.cache.get(existing.channelId);
    if (channel) {
      await interaction.editReply(`Du hast schon ein offenes Ticket: ${channel}`);
      return;
    }
    await prisma.ticket.update({
      where: { id: existing.id },
      data: { status: "closed", closedAt: new Date() },
    });
  }

  const next = await prisma.ticket.aggregate({ where: { guildId: guild.id }, _max: { number: true } });
  const number = (next._max.number ?? 0) + 1;
  const me = guild.members.me ?? (await guild.members.fetchMe());
  if (!me.permissions.has(PermissionFlagsBits.ManageChannels)) {
    await interaction.editReply("Mir fehlt die Berechtigung Kanäle verwalten.");
    return;
  }

  let channel: TextChannel;
  try {
    channel = await guild.channels.create({
      name: `ticket-${number}`,
      type: ChannelType.GuildText,
      parent: settings.categoryId,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: interaction.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
          ],
        },
        {
          id: settings.staffRoleId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageMessages,
          ],
        },
        {
          id: me.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageChannels,
            // Für das Ticket-Protokoll
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
      ],
    });
  } catch (error) {
    log.error({ err: error, guildId: guild.id }, "ticket channel failed");
    await interaction.editReply("Der Ticket-Kanal konnte nicht erstellt werden.");
    return;
  }

  try {
    await prisma.ticket.create({
      data: { guildId: guild.id, number, channelId: channel.id, ownerId: interaction.user.id },
    });
  } catch (error) {
    // Kanal nicht verwaist zurücklassen
    await channel.delete("Nexaly ticket konnte nicht gespeichert werden").catch(() => undefined);
    throw error;
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("ticket:close").setLabel("Schließen").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("ticket:delete").setLabel("Löschen").setStyle(ButtonStyle.Danger),
  );
  const mention = settings.staffRoleId ? `<@&${settings.staffRoleId}> ` : "";
  await channel.send({
    content: `${mention}<@${interaction.user.id}>`,
    embeds: [{ title: `Ticket #${number}`, description: settings.openMessage, color: 0x7c5cff }],
    components: [row],
  });
  if (settings.logChannelId) {
    const logChannel = guild.channels.cache.get(settings.logChannelId);
    if (logChannel?.isTextBased()) {
      await logChannel.send({
        embeds: [
          {
            title: `Ticket #${number} geöffnet`,
            description: `${interaction.user} · ${channel}`,
            color: 0x7c5cff,
          },
        ],
      }).catch(() => undefined);
    }
  }
  await interaction.editReply(`Ticket erstellt: ${channel}`);
}

async function closeTicket(interaction: ButtonInteraction, guild: Guild, redis: Redis): Promise<void> {
  const ticket = await prisma.ticket.findUnique({ where: { channelId: interaction.channelId } });
  if (!ticket || ticket.status !== "open") {
    await interaction.reply({ ephemeral: true, content: "Hier ist kein offenes Ticket." });
    return;
  }
  const member = interaction.member;
  if (!member || !("roles" in member)) return;
  const settings = await prisma.ticketSettings.findUnique({ where: { guildId: guild.id } });
  const allowed = ticket.ownerId === interaction.user.id || staff(member as GuildMember, settings?.staffRoleId ?? null);
  if (!allowed) {
    await interaction.reply({ ephemeral: true, content: "Nur der Ersteller oder das Team kann das Ticket schließen." });
    return;
  }
  if (busyChannels.has(interaction.channelId)) {
    await interaction.reply({ ephemeral: true, content: "Dieses Ticket wird gerade verarbeitet." });
    return;
  }
  busyChannels.add(interaction.channelId);
  try {
    const closedAt = new Date();
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: "closed", closedAt },
    });
    // Zuerst antworten: Discord erwartet die Antwort innerhalb von 3 Sekunden.
    await interaction.reply(`Ticket #${ticket.number} ist geschlossen.`);
    const channel = interaction.channel;
    if (channel?.isTextBased() && "permissionOverwrites" in channel) {
      await channel.permissionOverwrites.edit(ticket.ownerId, { SendMessages: false }).catch(() => undefined);
      // Umbenennen ist bei Discord stark limitiert (2x pro 10 Minuten) – nicht darauf warten.
      if ("setName" in channel) void channel.setName(`closed-${ticket.number}`).catch(() => undefined);
    }
    if (channel && channel.isTextBased() && !channel.isDMBased()) {
      try {
        await saveTicketTranscript({
          guild,
          channel,
          ticket: { ...ticket, closedAt },
          logChannelId: settings?.logChannelId ?? null,
          closedBy: interaction.user,
          redis,
        });
      } catch (error) {
        log.error({ err: error, guildId: guild.id, ticket: ticket.number }, "ticket transcript failed");
        await interaction
          .followUp({
            ephemeral: true,
            content: `Das Protokoll konnte nicht im Log-Kanal gespeichert werden: ${transcriptProblem(error)}`,
          })
          .catch(() => undefined);
      }
    }
  } finally {
    busyChannels.delete(interaction.channelId);
  }
}

async function deleteTicket(interaction: ButtonInteraction, guild: Guild, redis: Redis): Promise<void> {
  const member = interaction.member;
  if (!member || !("roles" in member)) return;
  const settings = await prisma.ticketSettings.findUnique({ where: { guildId: guild.id } });
  if (!staff(member as GuildMember, settings?.staffRoleId ?? null)) {
    await interaction.reply({ ephemeral: true, content: "Nur das Team kann den Kanal löschen." });
    return;
  }
  if (busyChannels.has(interaction.channelId)) {
    await interaction.reply({ ephemeral: true, content: "Dieses Ticket wird gerade verarbeitet." });
    return;
  }
  busyChannels.add(interaction.channelId);
  try {
    let ticket = await prisma.ticket.findUnique({ where: { channelId: interaction.channelId } });
    if (ticket && ticket.status === "open") {
      ticket = await prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: "closed", closedAt: new Date() },
      });
    }
    const channel = interaction.channel;
    const withTranscript = Boolean(ticket && settings?.logChannelId);
    await interaction.reply(
      withTranscript ? "Protokoll wird gespeichert, danach wird der Kanal gelöscht." : "Kanal wird gelöscht.",
    );

    if (ticket && channel && channel.isTextBased() && !channel.isDMBased()) {
      try {
        // Nur senden, wenn seit dem Protokoll beim Schließen noch etwas geschrieben wurde.
        await saveTicketTranscript({
          guild,
          channel,
          ticket,
          logChannelId: settings?.logChannelId ?? null,
          closedBy: interaction.user,
          redis,
          onlyIfChanged: true,
        });
      } catch (error) {
        // Ohne gesichertes Protokoll nicht löschen – sonst ist der Verlauf endgültig weg.
        log.error({ err: error, guildId: guild.id, ticket: ticket.number }, "ticket transcript failed");
        await interaction
          .followUp({
            ephemeral: true,
            content:
              `Das Protokoll konnte nicht gespeichert werden: ${transcriptProblem(error)}\n` +
              "Der Kanal wurde deshalb **nicht** gelöscht. Behebe das Problem und klicke erneut auf Löschen, " +
              "oder lösche den Kanal von Hand, wenn du kein Protokoll brauchst.",
          })
          .catch(() => undefined);
        return;
      }
    }
    if (channel && "delete" in channel) await channel.delete("Nexaly ticket").catch(() => undefined);
  } finally {
    busyChannels.delete(interaction.channelId);
  }
}

export function registerTickets(client: Client, redis: Redis): void {
  client.on(Events.InteractionCreate, (interaction) => {
    if (!interaction.isButton() || !interaction.guild) return;
    const run = async () => {
      if (interaction.customId === "ticket:open") return openTicket(interaction);
      if (interaction.customId === "ticket:close") return closeTicket(interaction, interaction.guild!, redis);
      if (interaction.customId === "ticket:delete") return deleteTicket(interaction, interaction.guild!, redis);
    };
    void run().catch((error) => {
      log.error({ err: error }, "ticket interaction failed");
      const payload = { content: "Das Ticket konnte nicht verarbeitet werden.", ephemeral: true as const };
      if (interaction.replied || interaction.deferred) void interaction.followUp(payload);
      else void interaction.reply(payload);
    });
  });
}
