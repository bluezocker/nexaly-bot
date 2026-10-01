import { z } from "zod";

const snowflake = z.preprocess(
  (value) => (value === "" ? null : value),
  z.string().regex(/^\d{17,20}$/).nullable(),
);

export const ticketSettingsSchema = z
  .object({
    enabled: z.boolean(),
    panelChannelId: snowflake,
    categoryId: snowflake,
    staffRoleId: snowflake,
    logChannelId: snowflake,
    panelTitle: z.string().trim().min(1).max(80),
    panelText: z.string().trim().min(1).max(1000),
    openMessage: z.string().trim().min(1).max(1000),
  })
  .strip();

export type TicketSettingsInput = z.infer<typeof ticketSettingsSchema>;
