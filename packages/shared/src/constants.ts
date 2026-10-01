export const MODULE_KEYS = ["logs", "moderation", "welcome", "levels", "streams", "embeds", "tickets", "social"] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

export const DEFAULT_BOT_PERMISSIONS = (
  (1n << 11n) | (1n << 14n) | (1n << 15n) | (1n << 16n) | (1n << 40n) |
  (1n << 1n) | (1n << 2n) | (1n << 4n) | (1n << 6n) | (1n << 13n) | (1n << 27n) | (1n << 28n) |
  (1n << 10n) | (1n << 20n) | (1n << 7n)
).toString();

export const DISCORD_API_BASE = "https://discord.com/api/v10";
export const DISCORD_OAUTH_AUTHORIZE = "https://discord.com/oauth2/authorize";
export const DISCORD_OAUTH_TOKEN = "https://discord.com/api/v10/oauth2/token";
