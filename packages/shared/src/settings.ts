import { z } from "zod";
import { MODULE_KEYS } from "./constants.js";

export const MODULE_LABELS: Record<(typeof MODULE_KEYS)[number], string> = {
  logs: "Logs",
  moderation: "Moderation",
  welcome: "Willkommen",
  levels: "Level",
  streams: "Live-Alerts",
  embeds: "Embeds",
  tickets: "Tickets",
  social: "Social",
};

export const TIMEZONES = [
  "Europe/Berlin",
  "Europe/Vienna",
  "Europe/Zurich",
  "Europe/London",
  "UTC",
] as const;

const snowflake = z.string().regex(/^\d{17,20}$/);

export const guildSettingsUpdateSchema = z
  .object({
    locale: z.enum(["de", "en"]),
    timezone: z.enum(TIMEZONES),
    managerRoleIds: z.array(snowflake).max(25),
    dataRetentionDays: z.number().int().min(7).max(365),
    deletedMessageLogDays: z.number().int().min(1).max(90),
    modules: z
      .array(
        z.object({
          key: z.enum(MODULE_KEYS),
          enabled: z.boolean(),
        }),
      )
      .max(MODULE_KEYS.length),
  })
  .strict();

export type GuildSettingsUpdate = z.infer<typeof guildSettingsUpdateSchema>;
