import { prisma } from "@nexaly/database";
import { LOG_EVENT_KEYS, type LogEventKey } from "@nexaly/shared";

export interface LogEventRuntime {
  enabled: boolean;
  channelId: string | null;
}

export interface LogGuildConfig {
  moduleEnabled: boolean;
  retentionDays: number;
  deletedMessageLogDays: number;
  events: Record<LogEventKey, LogEventRuntime>;
}

const cache = new Map<string, LogGuildConfig>();

function emptyEvents(): Record<LogEventKey, LogEventRuntime> {
  return Object.fromEntries(
    LOG_EVENT_KEYS.map((key) => [key, { enabled: false, channelId: null }]),
  ) as Record<LogEventKey, LogEventRuntime>;
}

export function invalidateLogConfig(guildId: string): void {
  cache.delete(guildId);
}

export async function getLogConfig(guildId: string): Promise<LogGuildConfig> {
  const cached = cache.get(guildId);
  if (cached) return cached;

  const [moduleRow, settings, guildSettings] = await Promise.all([
    prisma.guildModule.findUnique({
      where: { guildId_key: { guildId, key: "logs" } },
    }),
    prisma.logEventSetting.findMany({ where: { guildId } }),
    prisma.guildSettings.findUnique({ where: { guildId } }),
  ]);

  const events = emptyEvents();
  for (const row of settings) {
    if ((LOG_EVENT_KEYS as string[]).includes(row.eventKey)) {
      events[row.eventKey as LogEventKey] = {
        enabled: row.enabled,
        channelId: row.channelId,
      };
    }
  }

  const config: LogGuildConfig = {
    moduleEnabled: moduleRow?.enabled ?? false,
    retentionDays: guildSettings?.dataRetentionDays ?? 90,
    deletedMessageLogDays: guildSettings?.deletedMessageLogDays ?? 30,
    events,
  };
  cache.set(guildId, config);
  return config;
}

export function isEventEnabled(config: LogGuildConfig, key: LogEventKey): string | null {
  if (!config.moduleEnabled) return null;
  const event = config.events[key];
  if (!event?.enabled || !event.channelId) return null;
  return event.channelId;
}
