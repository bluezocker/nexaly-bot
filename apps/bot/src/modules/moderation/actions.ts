import type { Client, Guild, GuildMember, User } from "discord.js";
import type { ModAction } from "@nexaly/database";
import { emitBotModerationLog } from "../logs/index.js";
import { createCase } from "./cases.js";

export async function applyAction(input: {
  client: Client;
  guild: Guild;
  target: GuildMember | User;
  moderatorId: string;
  action: ModAction;
  reason: string;
  durationSec?: number | null;
}): Promise<{ caseNumber: number } | { error: string }> {
  const reason = input.reason.slice(0, 400);
  const targetId = input.target.id;
  const member = "guild" in input.target ? (input.target as GuildMember) : null;

  try {
    switch (input.action) {
      case "DELETE":
        break;
      case "WARN":
        break;
      case "TIMEOUT": {
        if (!member) return { error: "Timeout nur auf Servermitglieder." };
        const ms = Math.min(Math.max(input.durationSec ?? 60, 1) * 1000, 28 * 24 * 3600 * 1000);
        await member.timeout(ms, reason);
        break;
      }
      case "UNTIMEOUT": {
        if (!member) return { error: "Kein Mitglied." };
        await member.timeout(null, reason);
        break;
      }
      case "KICK": {
        if (!member?.kickable) return { error: "Kick nicht möglich." };
        await member.kick(reason);
        break;
      }
      case "BAN": {
        await input.guild.members.ban(targetId, { reason, deleteMessageSeconds: 0 });
        break;
      }
      case "UNBAN": {
        await input.guild.bans.remove(targetId, reason);
        break;
      }
      default:
        break;
    }
  } catch {
    return { error: "Discord hat die Aktion abgelehnt (Rechte oder Hierarchie)." };
  }

  const created = await createCase({
    guildId: input.guild.id,
    targetId,
    moderatorId: input.moderatorId,
    action: input.action,
    reason,
    durationSec: input.durationSec ?? null,
  });

  await emitBotModerationLog({
    client: input.client,
    guild: input.guild,
    action: `${input.action} #${created.caseNumber}`,
    targetId,
    reason,
    moderatorId: input.moderatorId,
  });

  return { caseNumber: created.caseNumber };
}
