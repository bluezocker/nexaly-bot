import {
  REST,
  Routes,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Client,
} from "discord.js";

import { levelCommands } from "../modules/levels/commands.js";
import { moderationCommands } from "../modules/moderation/commands.js";

export const commands = [
  {
    data: new SlashCommandBuilder().setName("ping").setDescription("Prüft, ob Nexaly erreichbar ist."),
    async execute(interaction: ChatInputCommandInteraction) {
      const started = Date.now();
      await interaction.reply({ content: "Nexaly ist online.", ephemeral: true });
      await interaction.editReply(
        `Nexaly ist online. Latenz ${Date.now() - started}ms · WS ${Math.round(interaction.client.ws.ping)}ms`,
      );
    },
  },
  {
    data: new SlashCommandBuilder().setName("help").setDescription("Kurze Übersicht zu Nexaly."),
    async execute(interaction: ChatInputCommandInteraction) {
      await interaction.reply({
        ephemeral: true,
        content:
          "**Nexaly** — Dashboard für Einstellungen. `/rank` `/leaderboard` · Moderation `/warn` `/timeout` `/kick` `/ban`.",
      });
    },
  },
  ...moderationCommands,
  ...levelCommands,
];

export async function registerCommands(input: {
  token: string;
  clientId: string;
  devGuildId?: string;
}): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(input.token);
  const body = commands.map((command) => command.data.toJSON());
  if (input.devGuildId) {
    await rest.put(Routes.applicationGuildCommands(input.clientId, input.devGuildId), { body });
    return;
  }
  await rest.put(Routes.applicationCommands(input.clientId), { body });
}

export function bindCommandHandler(client: Client): void {
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const command = commands.find((item) => item.data.name === interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction);
    } catch (error) {
      const payload = { content: "Der Befehl ist fehlgeschlagen.", ephemeral: true as const };
      if (interaction.replied || interaction.deferred) await interaction.followUp(payload);
      else await interaction.reply(payload);
      console.error(error);
    }
  });
}
