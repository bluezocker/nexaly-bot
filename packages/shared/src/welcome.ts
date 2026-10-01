import { z } from "zod";

export const WELCOME_MODES = ["TEXT", "EMBED", "IMAGE"] as const;
export type WelcomeModeName = (typeof WELCOME_MODES)[number];

const snowflake = z.string().regex(/^\d{17,20}$/);
const hexColor = z.string().regex(/^#?[0-9a-fA-F]{6}$/);

export const welcomeEmbedSchema = z
  .object({
    title: z.string().max(256).optional(),
    description: z.string().max(2000).optional(),
    color: z.number().int().min(0).max(0xffffff).optional(),
  })
  .strip();

export const welcomeSettingsUpdateSchema = z
  .object({
    enabled: z.boolean(),
    channelId: snowflake.nullable(),
    sendDm: z.boolean(),
    dmTemplate: z.string().max(1800).nullable(),
    mode: z.enum(WELCOME_MODES),
    textTemplate: z.string().max(1800).nullable(),
    embedJson: welcomeEmbedSchema.nullable(),
    backgroundAssetId: z.string().min(1).max(64).nullable(),
    textColor: hexColor,
    accentColor: hexColor,
    avatarX: z.number().min(0).max(1),
    avatarY: z.number().min(0).max(1),
    nameX: z.number().min(0).max(1),
    nameY: z.number().min(0).max(1),
    customText: z.string().max(80).nullable(),
  })
  .strip();

export type WelcomeSettingsUpdate = z.infer<typeof welcomeSettingsUpdateSchema>;
export type WelcomeEmbed = z.infer<typeof welcomeEmbedSchema>;

export interface WelcomeVars {
  user: string;
  userName: string;
  userId: string;
  mention: string;
  server: string;
  memberCount: string;
}

export function welcomeVars(input: {
  username: string;
  userId: string;
  guildName: string;
  memberCount: number;
}): WelcomeVars {
  return {
    user: input.username,
    userName: input.username,
    userId: input.userId,
    mention: `<@${input.userId}>`,
    server: input.guildName,
    memberCount: String(input.memberCount),
  };
}

export function interpolateWelcome(template: string, vars: WelcomeVars): string {
  return template
    .replaceAll("{user.mention}", vars.mention)
    .replaceAll("{user.name}", vars.userName)
    .replaceAll("{user.tag}", vars.userName)
    .replaceAll("{user.id}", vars.userId)
    .replaceAll("{user}", vars.mention)
    .replaceAll("{server}", vars.server)
    .replaceAll("{memberCount}", vars.memberCount);
}

export const DEFAULT_WELCOME_TEXT =
  "Willkommen {user} auf **{server}** — du bist Mitglied #{memberCount}.";

export const DEFAULT_WELCOME_DM = "Willkommen auf {server}!";

export interface WelcomeCardJob {
  kind: "preview" | "send";
  jobId: string;
  guildId: string;
  channelId?: string;
  userId: string;
  username: string;
  avatarUrl: string | null;
  guildName: string;
  memberCount: number;
  textColor: string;
  accentColor: string;
  avatarX: number;
  avatarY: number;
  nameX: number;
  nameY: number;
  customText: string | null;
  backgroundPath: string | null;
  caption?: string;
}

export const WELCOME_QUEUE = "nexaly:welcome:jobs";
export function welcomeResultKey(jobId: string): string {
  return `nexaly:welcome:result:${jobId}`;
}
