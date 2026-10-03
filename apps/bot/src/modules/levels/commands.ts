import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { prisma } from "@nexaly/database";
import { levelFromXp } from "@nexaly/shared";
import { getLevelConfig } from "./config.js";

export const levelCommands = [
  {
    data: new SlashCommandBuilder()
      .setName("rank")
      .setDescription("Zeigt XP und Level")
      .addUserOption((o) => o.setName("user").setDescription("Mitglied")) as SlashCommandBuilder,
    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guildId) {
        await interaction.reply({ content: "Nur auf einem Server.", ephemeral: true });
        return;
      }
      const user = interaction.options.getUser("user") ?? interaction.user;
      const row = await prisma.memberLevel.findUnique({
        where: { guildId_userId: { guildId: interaction.guildId, userId: user.id } },
      });
      if (!row) {
        await interaction.reply({ content: `${user.tag} hat noch keine XP.`, ephemeral: true });
        return;
      }
      const curve = levelFromXp(row.xp);
      const higher = await prisma.memberLevel.count({
        where: { guildId: interaction.guildId, xp: { gt: row.xp } },
      });
      await interaction.reply({
        content: `${user.tag} · Level ${row.level} · ${row.xp} XP (${curve.intoLevel}/${curve.needed}) · Rang #${higher + 1}`,
        ephemeral: true,
      });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("leaderboard")
      .setDescription("Top-Mitglieder nach XP") as SlashCommandBuilder,
    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guildId) {
        await interaction.reply({ content: "Nur auf einem Server.", ephemeral: true });
        return;
      }
      const rows = await prisma.memberLevel.findMany({
        where: { guildId: interaction.guildId },
        orderBy: { xp: "desc" },
        take: 10,
      });
      if (!rows.length) {
        await interaction.reply({ content: "Noch keine XP auf diesem Server.", ephemeral: true });
        return;
      }
      const lines = rows.map(
        (row: { userId: string; level: number; xp: number }, index: number) =>
          `#${index + 1} <@${row.userId}> · Lvl ${row.level} · ${row.xp} XP`,
      );
      const config = await getLevelConfig(interaction.guildId);
      const webUrl = process.env.PUBLIC_WEB_URL?.replace(/\/+$/, "");
      if (config?.enabled && config.publicLeaderboard && webUrl) {
        lines.push("", `Ganze Rangliste: ${webUrl}/leaderboard/${interaction.guildId}`);
      }
      await interaction.reply({ content: lines.join("\n"), ephemeral: true });
    },
  },
];
