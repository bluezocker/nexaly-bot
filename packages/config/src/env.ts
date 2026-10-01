import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  PUBLIC_WEB_URL: z.string().url().default("http://localhost:3000"),
  PUBLIC_API_URL: z.string().url().default("http://localhost:3001"),
  API_PORT: z.coerce.number().int().positive().default(3001),
  WEB_PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  DISCORD_TOKEN: z.string().min(1).optional(),
  DISCORD_CLIENT_ID: z.string().min(1).optional(),
  DISCORD_CLIENT_SECRET: z.string().min(1).optional(),
  DISCORD_REDIRECT_URI: z.string().url().optional(),
  DISCORD_DEV_GUILD_ID: z.string().optional(),
  SESSION_SECRET: z.string().min(32),
  TWITCH_CLIENT_ID: z.string().optional(),
  TWITCH_CLIENT_SECRET: z.string().optional(),
  TWITCH_EVENTSUB_SECRET: z.string().optional(),
  TWITCH_EVENTSUB_CALLBACK_URL: z.string().url().optional(),
  YOUTUBE_API_KEY: z.string().optional(),
  KICK_CLIENT_ID: z.string().optional(),
  KICK_CLIENT_SECRET: z.string().optional(),
  X_BEARER_TOKEN: z.string().optional(),
  THREADS_APP_ID: z.string().optional(),
  THREADS_APP_SECRET: z.string().optional(),
  THREADS_REDIRECT_URI: z.string().url().optional(),
  ASSET_DIR: z.string().default("./uploads"),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === "production" && /change-me|nexaly$|password|secret123/i.test(env.SESSION_SECRET)) {
    throw new Error("SESSION_SECRET is too weak for production");
  }
  if (env.NODE_ENV === "production" && env.DATABASE_URL.includes("nexaly:nexaly@")) {
    throw new Error("Default database credentials are not allowed in production");
  }
  return env;
}

export function loadBotEnv(source: NodeJS.ProcessEnv = process.env): Env & { DISCORD_TOKEN: string } {
  const env = loadEnv(source);
  if (!env.DISCORD_TOKEN) throw new Error("DISCORD_TOKEN is required for the bot process");
  return { ...env, DISCORD_TOKEN: env.DISCORD_TOKEN };
}

export function loadApiEnv(source: NodeJS.ProcessEnv = process.env): Env & {
  DISCORD_CLIENT_ID: string;
  DISCORD_CLIENT_SECRET: string;
  DISCORD_REDIRECT_URI: string;
} {
  const env = loadEnv(source);
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !env.DISCORD_REDIRECT_URI) {
    throw new Error("DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET and DISCORD_REDIRECT_URI are required for the API");
  }
  return {
    ...env,
    DISCORD_CLIENT_ID: env.DISCORD_CLIENT_ID,
    DISCORD_CLIENT_SECRET: env.DISCORD_CLIENT_SECRET,
    DISCORD_REDIRECT_URI: env.DISCORD_REDIRECT_URI,
  };
}
