import { z } from "zod";
import { EMOJI_SHORTCODES } from "./emoji-shortcodes.js";

const snowflake = z.string().regex(/^\d{17,20}$/);
const url = z.string().url().max(2048);

export const embedFieldSchema = z.object({
  name: z.string().min(1).max(256),
  value: z.string().min(1).max(1024),
  inline: z.boolean().optional(),
});

export const embedPayloadSchema = z
  .object({
    title: z.string().max(256).optional(),
    description: z.string().max(4096).optional(),
    url: url.optional().or(z.literal("")),
    color: z.number().int().min(0).max(0xffffff).optional(),
    timestamp: z.boolean().optional(),
    footer: z.string().max(2048).optional(),
    author: z.string().max(256).optional(),
    thumbnail: url.optional().or(z.literal("")),
    image: url.optional().or(z.literal("")),
    fields: z.array(embedFieldSchema).max(25).default([]),
  })
  .strict()
  .refine((value) => Boolean(value.title || value.description || value.fields.length || value.image), {
    message: "Embed needs title, description, field or image",
  });

export const embedTemplateSchema = z
  .object({
    name: z.string().min(1).max(80),
    content: z.string().max(1800).optional(),
    embed: embedPayloadSchema,
  })
  .strict();

function resolveEmoji(raw: string): string | null {
  const trimmed = raw.trim();
  const custom = trimmed.match(/^<a?:([\w~]+):(\d{17,20})>$/);
  if (custom?.[1] && custom[2]) return `${custom[1]}:${custom[2]}`;
  const key = trimmed.replace(/^:+|:+$/g, "").toLowerCase().replace(/[\s-]+/g, "_");
  if (/^[a-z0-9_]+$/.test(key)) return EMOJI_SHORTCODES[key] ?? null;
  return trimmed;
}

const emojiField = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .transform((value, ctx) => {
    const emoji = resolveEmoji(value);
    if (!emoji) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Unbekanntes Emoji. Zeichen, :blue_heart: oder <:name:id> verwenden.",
      });
      return z.NEVER;
    }
    return emoji;
  });

export const reactionRoleSchema = z.object({
  emoji: emojiField,
  roleId: snowflake,
});

export const existingReactionSchema = z
  .object({
    channelId: snowflake.optional(),
    message: z.string().trim().min(1).max(200),
    reactions: z.array(reactionRoleSchema).min(1).max(20),
  })
  .strict();

export const embedSendSchema = z
  .object({
    channelId: snowflake,
    templateId: z.string().min(1).optional(),
    content: z.string().max(1800).optional(),
    embed: embedPayloadSchema.optional(),
    reactions: z.array(reactionRoleSchema).max(20).optional(),
  })
  .strict()
  .refine((value) => Boolean(value.templateId || value.embed), {
    message: "Provide embed or templateId",
  });

export type EmbedPayload = z.infer<typeof embedPayloadSchema>;

export function toDiscordEmbed(embed: EmbedPayload): Record<string, unknown> {
  return {
    title: embed.title || undefined,
    description: embed.description || undefined,
    url: embed.url || undefined,
    color: embed.color,
    timestamp: embed.timestamp ? new Date().toISOString() : undefined,
    footer: embed.footer ? { text: embed.footer } : undefined,
    author: embed.author ? { name: embed.author } : undefined,
    thumbnail: embed.thumbnail ? { url: embed.thumbnail } : undefined,
    image: embed.image ? { url: embed.image } : undefined,
    fields: embed.fields.map((field) => ({
      name: field.name,
      value: field.value,
      inline: field.inline ?? false,
    })),
  };
}
