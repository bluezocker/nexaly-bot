import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type GuildMember,
} from "discord.js";
import { applyAction } from "./actions.js";
import { listWarnings } from "./cases.js";
import { canModerate } from "./hierarchy.js";

type Command = {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
};

function actorTargetBot(interaction: ChatInputCommandInteraction) {
  const actor = interaction.member as GuildMember | null;
  const bot = interaction.guild?.members.me ?? null;
  return { actor, bot };
}

async function moderate(
  interaction: ChatInputCommandInteraction,
  action: "WARN" | "TIMEOUT" | "UNTIMEOUT" | "KICK" | "BAN",
): Promise<void> {
  if (!interaction.inGuild() || !interaction.guild) {
    await interaction.reply({ content: "Nur auf einem Server.", ephemeral: true });
    return;
  }
  const user = interaction.options.getUser("user", true);
  const reason = interaction.options.getString("reason") ?? "Kein Grund angegeben";
  const duration = interaction.options.getInteger("duration");
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  const { actor, bot } = actorTargetBot(interaction);
  if (!actor || !bot) {
    await interaction.reply({ content: "Mitgliedsdaten fehlen.", ephemeral: true });
    return;
  }
  if (member) {
    const gate = canModerate(actor, member, bot);
    if (!gate.allowed) {
      await interaction.reply({ content: gate.message, ephemeral: true });
      return;
    }
  } else if (action !== "BAN" && action !== "UNBAN") {
    await interaction.reply({ content: "Mitglied nicht auf dem Server gefunden.", ephemeral: true });
    return;
  }

  const result = await applyAction({
    client: interaction.client,
    guild: interaction.guild,
    target: member ?? user,
    moderatorId: actor.id,
    action,
    reason,
    durationSec: duration,
  });
  if ("error" in result) {
    await interaction.reply({ content: result.error, ephemeral: true });
    return;
  }
  await interaction.reply({ content: `Case #${result.caseNumber} · ${action} ${user.tag}`, ephemeral: true });
}

export const moderationCommands: Command[] = [
  {
    data: new SlashCommandBuilder()
      .setName("warn")
      .setDescription("Verwarnt ein Mitglied")
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption((o) => o.setName("user").setDescription("Ziel").setRequired(true))
      .addStringOption((o) => o.setName("reason").setDescription("Grund")) as SlashCommandBuilder,
    execute: (i) => moderate(i, "WARN"),
  },
  {
    data: new SlashCommandBuilder()
      .setName("warnings")
      .setDescription("Zeigt Verwarnungen")
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption((o) => o.setName("user").setDescription("Mitglied").setRequired(true)) as SlashCommandBuilder,
    async execute(interaction) {
      if (!interaction.guildId) return;
      const user = interaction.options.getUser("user", true);
      const rows = await listWarnings(interaction.guildId, user.id);
      if (rows.length === 0) {
        await interaction.reply({ content: `${user.tag} hat keine Verwarnungen.`, ephemeral: true });
        return;
      }
      const lines = rows.map(
        (row) => `#${row.case.caseNumber} · ${row.case.reason ?? "—"} · ${row.createdAt.toISOString()}`,
      );
      await interaction.reply({ content: lines.join("\n").slice(0, 1800), ephemeral: true });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("timeout")
      .setDescription("Timeout für ein Mitglied")
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption((o) => o.setName("user").setDescription("Ziel").setRequired(true))
      .addIntegerOption((o) =>
        o.setName("duration").setDescription("Sekunden").setRequired(true).setMinValue(1).setMaxValue(2419200),
      )
      .addStringOption((o) => o.setName("reason").setDescription("Grund")) as SlashCommandBuilder,
    execute: (i) => moderate(i, "TIMEOUT"),
  },
  {
    data: new SlashCommandBuilder()
      .setName("untimeout")
      .setDescription("Timeout aufheben")
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption((o) => o.setName("user").setDescription("Ziel").setRequired(true))
      .addStringOption((o) => o.setName("reason").setDescription("Grund")) as SlashCommandBuilder,
    execute: (i) => moderate(i, "UNTIMEOUT"),
  },
  {
    data: new SlashCommandBuilder()
      .setName("kick")
      .setDescription("Mitglied kicken")
      .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
      .addUserOption((o) => o.setName("user").setDescription("Ziel").setRequired(true))
      .addStringOption((o) => o.setName("reason").setDescription("Grund")) as SlashCommandBuilder,
    execute: (i) => moderate(i, "KICK"),
  },
  {
    data: new SlashCommandBuilder()
      .setName("ban")
      .setDescription("Mitglied bannen")
      .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
      .addUserOption((o) => o.setName("user").setDescription("Ziel").setRequired(true))
      .addStringOption((o) => o.setName("reason").setDescription("Grund")) as SlashCommandBuilder,
    execute: (i) => moderate(i, "BAN"),
  },
  {
    data: new SlashCommandBuilder()
      .setName("unban")
      .setDescription("Ban aufheben")
      .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
      .addUserOption((o) => o.setName("user").setDescription("User-ID als User").setRequired(true))
      .addStringOption((o) => o.setName("reason").setDescription("Grund")) as SlashCommandBuilder,
    async execute(interaction) {
      if (!interaction.guild) return;
      const user = interaction.options.getUser("user", true);
      const reason = interaction.options.getString("reason") ?? "Unban";
      const result = await applyAction({
        client: interaction.client,
        guild: interaction.guild,
        target: user,
        moderatorId: interaction.user.id,
        action: "UNBAN",
        reason,
      });
      if ("error" in result) {
        await interaction.reply({ content: result.error, ephemeral: true });
        return;
      }
      await interaction.reply({ content: `Case #${result.caseNumber} · UNBAN ${user.tag}`, ephemeral: true });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("purge")
      .setDescription("Nachrichten im Kanal löschen")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .addIntegerOption((o) =>
        o.setName("count").setDescription("Anzahl 1–100").setRequired(true).setMinValue(1).setMaxValue(100),
      ) as SlashCommandBuilder,
    async execute(interaction) {
      if (!interaction.channel || !interaction.channel.isTextBased() || interaction.channel.isDMBased()) {
        await interaction.reply({ content: "Kein Textkanal.", ephemeral: true });
        return;
      }
      const count = interaction.options.getInteger("count", true);
      const deleted = await interaction.channel.bulkDelete(count, true);
      await interaction.reply({ content: `${deleted.size} Nachrichten gelöscht.`, ephemeral: true });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("slowmode")
      .setDescription("Slowmode setzen")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
      .addIntegerOption((o) =>
        o.setName("seconds").setDescription("0–21600").setRequired(true).setMinValue(0).setMaxValue(21600),
      ) as SlashCommandBuilder,
    async execute(interaction) {
      if (!interaction.channel || !("setRateLimitPerUser" in interaction.channel)) {
        await interaction.reply({ content: "Slowmode hier nicht möglich.", ephemeral: true });
        return;
      }
      const seconds = interaction.options.getInteger("seconds", true);
      await interaction.channel.setRateLimitPerUser(seconds);
      await interaction.reply({ content: `Slowmode: ${seconds}s`, ephemeral: true });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("userinfo")
      .setDescription("Infos zu einem Mitglied")
      .addUserOption((o) => o.setName("user").setDescription("Mitglied")) as SlashCommandBuilder,
    async execute(interaction) {
      const user = interaction.options.getUser("user") ?? interaction.user;
      const member = interaction.guild ? await interaction.guild.members.fetch(user.id).catch(() => null) : null;
      const lines = [
        `Tag: ${user.tag}`,
        `ID: ${user.id}`,
        `Account: ${user.createdAt.toISOString()}`,
        member ? `Beigetreten: ${member.joinedAt?.toISOString() ?? "—"}` : "Nicht auf diesem Server",
      ];
      await interaction.reply({ content: lines.join("\n"), ephemeral: true });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("serverinfo")
      .setDescription("Infos zum Server") as SlashCommandBuilder,
    async execute(interaction) {
      const guild = interaction.guild;
      if (!guild) {
        await interaction.reply({ content: "Nur auf einem Server.", ephemeral: true });
        return;
      }
      await interaction.reply({
        content: [
          guild.name,
          `ID: ${guild.id}`,
          `Mitglieder: ${guild.memberCount}`,
          `Erstellt: ${guild.createdAt.toISOString()}`,
        ].join("\n"),
        ephemeral: true,
      });
    },
  },
];
