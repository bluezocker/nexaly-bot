import { z } from "zod";

export const LOG_EVENT_GROUPS = [
  { id: "messages", label: "Nachrichten" },
  { id: "members", label: "Mitglieder" },
  { id: "moderation", label: "Moderation" },
  { id: "roles", label: "Rollen" },
  { id: "channels", label: "Kanäle" },
  { id: "voice", label: "Voice" },
] as const;

export const LOG_EVENTS = [
  { key: "messageDelete", label: "Gelöschte Nachrichten", group: "messages" },
  { key: "messageUpdate", label: "Bearbeitete Nachrichten", group: "messages" },
  { key: "memberJoin", label: "Mitglied beigetreten", group: "members" },
  { key: "memberLeave", label: "Mitglied verlassen", group: "members" },
  { key: "nicknameUpdate", label: "Nickname-Änderungen", group: "members" },
  { key: "banAdd", label: "Bans", group: "moderation" },
  { key: "banRemove", label: "Entbannungen", group: "moderation" },
  { key: "kick", label: "Kicks", group: "moderation" },
  { key: "timeout", label: "Timeouts", group: "moderation" },
  { key: "botModeration", label: "Moderationsaktionen des Bots", group: "moderation" },
  { key: "memberRoleUpdate", label: "Rollenänderungen an Mitgliedern", group: "roles" },
  { key: "roleCreate", label: "Rolle erstellt", group: "roles" },
  { key: "roleDelete", label: "Rolle gelöscht", group: "roles" },
  { key: "channelCreate", label: "Kanal erstellt", group: "channels" },
  { key: "channelDelete", label: "Kanal gelöscht", group: "channels" },
  { key: "channelUpdate", label: "Kanal geändert", group: "channels" },
  { key: "voiceJoin", label: "Voice beigetreten", group: "voice" },
  { key: "voiceLeave", label: "Voice verlassen", group: "voice" },
  { key: "voiceMove", label: "Voice-Kanal gewechselt", group: "voice" },
] as const;

export type LogEventKey = (typeof LOG_EVENTS)[number]["key"];

export const LOG_EVENT_KEYS = LOG_EVENTS.map((event) => event.key) as [
  LogEventKey,
  ...LogEventKey[],
];

const snowflake = z
  .string()
  .regex(/^\d{17,20}$/)
  .nullable();

export const logEventSettingSchema = z.object({
  enabled: z.boolean(),
  channelId: snowflake,
});

export const logSettingsUpdateSchema = z
  .object({
    enabled: z.boolean(),
    events: z.record(z.enum(LOG_EVENT_KEYS), logEventSettingSchema),
  })
  .strict();

export type LogSettingsUpdate = z.infer<typeof logSettingsUpdateSchema>;

export const DISCORD_EMBED_DESCRIPTION_LIMIT = 4096;
export const DISCORD_EMBED_FIELD_LIMIT = 1024;

export function truncateEmbed(text: string, max: number): string {
  if (text.length <= max) return text;
  if (max <= 1) return "…";
  return `${text.slice(0, max - 1)}…`;
}

export interface AuditCandidate {
  action: string;
  targetId: string | null;
  executorId: string | null;
  createdAt: number;
}

/**
 * Returns an executor only when exactly one audit entry matches
 * target + action inside the time window. Never guesses.
 */
export function pickAuditExecutor(
  entries: AuditCandidate[],
  input: { action: string; targetId: string; now: number; windowMs: number },
): string | null {
  const matches = entries.filter((entry) => {
    if (entry.action !== input.action) return false;
    if (entry.targetId !== input.targetId) return false;
    if (!entry.executorId) return false;
    return input.now - entry.createdAt <= input.windowMs && input.now - entry.createdAt >= -1000;
  });

  if (matches.length !== 1) return null;
  return matches[0]?.executorId ?? null;
}

export function configChannel(name: string): string {
  return `guild:${name}:config`;
}
