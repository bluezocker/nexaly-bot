import { prisma } from "@nexaly/database";
import { createLogger } from "@nexaly/logger";
import { Events, PermissionFlagsBits, type Client, type MessageReaction, type PartialMessageReaction, type PartialUser, type User } from "discord.js";

const log = createLogger("reaction-roles");

function sameEmoji(stored: string, incoming: string): boolean {
  return stored.replaceAll("\uFE0F", "") === incoming.replaceAll("\uFE0F", "");
}

function emojiKey(reaction: MessageReaction | PartialMessageReaction): string | null {
  const emoji = reaction.emoji;
  if (emoji.id && emoji.name) return `${emoji.name}:${emoji.id}`;
  return emoji.name;
}

async function applyRole(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
  add: boolean,
): Promise<void> {
  if (user.bot) return;
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch {
      return;
    }
  }
  const message = reaction.message;
  if (!message.guildId || !message.id) return;
  const key = emojiKey(reaction);
  if (!key) return;
  const rows = await prisma.reactionRole.findMany({ where: { messageId: message.id } });
  const binding = rows.find((row) => sameEmoji(row.emoji, key));
  if (!binding) return;

  const guild = message.guild ?? (await message.client.guilds.fetch(message.guildId));
  const me = guild.members.me ?? (await guild.members.fetchMe());
  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
    log.warn({ guildId: guild.id }, "missing Manage Roles");
    return;
  }
  const role = await guild.roles.fetch(binding.roleId);
  if (!role || role.managed || role.position >= me.roles.highest.position) {
    log.warn({ guildId: guild.id, roleId: binding.roleId }, "role not assignable");
    return;
  }
  const member = await guild.members.fetch(user.id).catch(() => null);
  if (!member) return;
  if (add) await member.roles.add(role, "Nexaly reaction role");
  else if (member.roles.cache.has(role.id)) await member.roles.remove(role, "Nexaly reaction role");
}

export function registerReactionRoles(client: Client): void {
  client.on(Events.MessageReactionAdd, (reaction, user) => {
    void applyRole(reaction, user, true).catch((error) => log.error(error, "add role failed"));
  });
  client.on(Events.MessageReactionRemove, (reaction, user) => {
    void applyRole(reaction, user, false).catch((error) => log.error(error, "remove role failed"));
  });
}
