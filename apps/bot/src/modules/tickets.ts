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

const log = createLogger("tickets");

function staff(member: GuildMember, staffRoleId: string | null): boolean {
  if (member.permissions.has(PermissionFlagsBits.ManageChannels)) return true;
  return Boolean(staffRoleId && member.roles.cache.has(staffRoleId));
}

async function openTicket(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guild || !interaction.guildId) return;
  await interaction.deferReply({ ephemeral: true });
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
          ],
        },
      ],
    });
  } catch (error) {
    log.error({ err: error, guildId: guild.id }, "ticket channel failed");
    await interaction.editReply("Der Ticket-Kanal konnte nicht erstellt werden.");
    return;
  }

  await prisma.ticket.create({
    data: { guildId: guild.id, number, channelId: channel.id, ownerId: interaction.user.id },
  });

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

async function closeTicket(interaction: ButtonInteraction, guild: Guild): Promise<void> {
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
  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { status: "closed", closedAt: new Date() },
  });
  const channel = interaction.channel;
  if (channel?.isTextBased() && "permissionOverwrites" in channel) {
    await channel.permissionOverwrites.edit(ticket.ownerId, { SendMessages: false }).catch(() => undefined);
    if ("setName" in channel) await channel.setName(`closed-${ticket.number}`).catch(() => undefined);
  }
  await interaction.reply(`Ticket #${ticket.number} ist geschlossen.`);
}

async function deleteTicket(interaction: ButtonInteraction, guild: Guild): Promise<void> {
  const member = interaction.member;
  if (!member || !("roles" in member)) return;
  const settings = await prisma.ticketSettings.findUnique({ where: { guildId: guild.id } });
  if (!staff(member as GuildMember, settings?.staffRoleId ?? null)) {
    await interaction.reply({ ephemeral: true, content: "Nur das Team kann den Kanal löschen." });
    return;
  }
  const ticket = await prisma.ticket.findUnique({ where: { channelId: interaction.channelId } });
  if (ticket && ticket.status === "open") {
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: "closed", closedAt: new Date() },
    });
  }
  await interaction.reply("Kanal wird gelöscht.");
  const channel = interaction.channel;
  if (channel && "delete" in channel) await channel.delete("Nexaly ticket").catch(() => undefined);
}

export function registerTickets(client: Client): void {
  client.on(Events.InteractionCreate, (interaction) => {
    if (!interaction.isButton() || !interaction.guild) return;
    const run = async () => {
      if (interaction.customId === "ticket:open") return openTicket(interaction);
      if (interaction.customId === "ticket:close") return closeTicket(interaction, interaction.guild!);
      if (interaction.customId === "ticket:delete") return deleteTicket(interaction, interaction.guild!);
    };
    void run().catch((error) => {
      log.error({ err: error }, "ticket interaction failed");
      const payload = { content: "Das Ticket konnte nicht verarbeitet werden.", ephemeral: true as const };
      if (interaction.replied || interaction.deferred) void interaction.followUp(payload);
      else void interaction.reply(payload);
    });
  });
}
