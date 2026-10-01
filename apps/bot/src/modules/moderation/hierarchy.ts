import type { GuildMember } from "discord.js";
import { evaluateModerationHierarchy } from "@nexaly/shared";

export function highestPosition(member: GuildMember): number {
  return member.roles.highest.position;
}

export function canModerate(actor: GuildMember, target: GuildMember, bot: GuildMember): {
  allowed: boolean;
  message?: string;
} {
  if (target.id === actor.guild.ownerId) {
    return { allowed: false, message: "Der Serverbesitzer kann nicht moderiert werden." };
  }
  if (target.id === bot.id) {
    return { allowed: false, message: "Ich kann mich nicht selbst moderieren." };
  }
  if (target.id === actor.id) {
    return { allowed: false, message: "Du kannst diese Aktion nicht auf dich selbst anwenden." };
  }

  const result = evaluateModerationHierarchy({
    actorIsOwner: actor.id === actor.guild.ownerId,
    targetIsOwner: target.id === actor.guild.ownerId,
    targetIsBot: target.user.bot && target.id === bot.id,
    actorIsBot: false,
    actorHighestPosition: highestPosition(actor),
    targetHighestPosition: highestPosition(target),
  });
  if (!result.allowed) {
    return { allowed: false, message: "Die Rolle dieses Mitglieds steht über oder auf deiner." };
  }

  if (highestPosition(bot) <= highestPosition(target)) {
    return { allowed: false, message: "Meine Rolle steht nicht hoch genug für dieses Mitglied." };
  }

  return { allowed: true };
}
