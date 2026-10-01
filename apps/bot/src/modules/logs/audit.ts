import { AuditLogEvent, type Guild, type GuildAuditLogsEntry } from "discord.js";
import { pickAuditExecutor } from "@nexaly/shared";

const DEFAULT_DELAY_MS = 1200;
const WINDOW_MS = 12_000;

function actionName(event: AuditLogEvent): string {
  return AuditLogEvent[event] ?? String(event);
}

export async function resolveAuditExecutor(
  guild: Guild,
  event: AuditLogEvent,
  targetId: string,
  delayMs = DEFAULT_DELAY_MS,
): Promise<string | null> {
  if (!guild.members.me?.permissions.has("ViewAuditLog")) {
    return null;
  }

  await new Promise((resolve) => setTimeout(resolve, delayMs));

  try {
    const logs = await guild.fetchAuditLogs({ type: event, limit: 6 });
    const now = Date.now();
    const entries = [...logs.entries.values()].map((entry: GuildAuditLogsEntry) => ({
      action: actionName(entry.action as AuditLogEvent),
      targetId: entry.targetId,
      executorId: entry.executorId,
      createdAt: entry.createdTimestamp,
    }));
    return pickAuditExecutor(entries, {
      action: actionName(event),
      targetId,
      now,
      windowMs: WINDOW_MS,
    });
  } catch {
    return null;
  }
}
