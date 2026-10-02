import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import {
  WELCOME_QUEUE,
  configChannel,
  validationError,
  welcomeResultKey,
  welcomeSettingsUpdateSchema,
} from "@nexaly/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppDeps } from "../app.js";
import { requireDiscordToken, requireUser } from "../app.js";
import { fetchCurrentUserGuilds } from "../services/discord-oauth.js";
import { ensureGuildAccess } from "../services/guilds.js";

const guildParams = z.object({ guildId: z.string().regex(/^\d{17,20}$/) });
const uploadBody = z.object({
  mime: z.enum(["image/png", "image/jpeg", "image/webp"]),
  data: z.string().min(16),
});

function isImage(buffer: Buffer, mime: string): boolean {
  if (mime === "image/png") {
    return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mime === "image/jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
}

async function authorize(deps: AppDeps, request: Parameters<typeof requireUser>[0], guildId: string) {
  const { userId, sessionId } = await requireUser(request);
  const accessToken = await requireDiscordToken(deps.redis, sessionId);
  const oauthGuilds = await fetchCurrentUserGuilds(deps.redis, userId, accessToken);
  await ensureGuildAccess({ prisma: deps.prisma, userId, guildId, oauthGuilds });
  return { userId };
}

export async function registerWelcomeRoutes(app: FastifyInstance, deps: AppDeps): Promise<void> {
  app.get("/v1/guilds/:guildId/welcome", async (request) => {
    const params = guildParams.parse(request.params);
    await authorize(deps, request, params.guildId);
    const [moduleRow, settings] = await Promise.all([
      deps.prisma.guildModule.findUnique({
        where: { guildId_key: { guildId: params.guildId, key: "welcome" } },
      }),
      deps.prisma.welcomeSettings.findUnique({ where: { guildId: params.guildId } }),
    ]);
    return { enabled: moduleRow?.enabled ?? settings?.enabled ?? false, settings };
  });

  app.put("/v1/guilds/:guildId/welcome", async (request) => {
    const params = guildParams.parse(request.params);
    const { userId } = await authorize(deps, request, params.guildId);
    const parsed = welcomeSettingsUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "feld"}: ${issue.message}`)
        .slice(0, 3)
        .join("; ");
      throw validationError(
        detail ? `Ungültige Willkommens-Einstellungen (${detail})` : "Ungültige Willkommens-Einstellungen",
        parsed.error.issues,
      );
    }
    const guild = await deps.prisma.guild.findUnique({ where: { id: params.guildId } });
    if (!guild) throw validationError("Bot is not installed on this server");
    const data = parsed.data;

    await deps.prisma.$transaction(async (tx) => {
      await tx.guildModule.upsert({
        where: { guildId_key: { guildId: params.guildId, key: "welcome" } },
        create: { guildId: params.guildId, key: "welcome", enabled: data.enabled },
        update: { enabled: data.enabled },
      });
      await tx.welcomeSettings.upsert({
        where: { guildId: params.guildId },
        create: { guildId: params.guildId, ...data },
        update: data,
      });
      await tx.auditEntry.create({
        data: { guildId: params.guildId, actorId: userId, action: "welcome.update" },
      });
    });
    await deps.redis.publish(configChannel(params.guildId), JSON.stringify({ module: "welcome" }));
    return { ok: true };
  });

  // Base64 macht 2 MB Bild zu ~2,7 MB JSON – Fastify-Standard (1 MB) reicht dafür nicht.
  app.post("/v1/guilds/:guildId/welcome/background", { bodyLimit: 4 * 1024 * 1024 }, async (request) => {
    const params = guildParams.parse(request.params);
    const { userId } = await authorize(deps, request, params.guildId);
    const parsed = uploadBody.safeParse(request.body);
    if (!parsed.success) throw validationError("Invalid image upload", parsed.error.issues);
    const buffer = Buffer.from(parsed.data.data, "base64");
    if (buffer.byteLength > 2 * 1024 * 1024 || !isImage(buffer, parsed.data.mime)) {
      throw validationError("Image exceeds 2 MB or is not a real image");
    }
    const ext = parsed.data.mime === "image/png" ? "png" : parsed.data.mime === "image/webp" ? "webp" : "jpg";
    const id = randomUUID();
    const root = resolve(deps.env.ASSET_DIR);
    const dir = resolve(join(root, params.guildId));
    if (!dir.startsWith(root)) throw validationError("Invalid asset path");
    await mkdir(dir, { recursive: true });
    const storageKey = join(dir, `${id}.${ext}`);
    await writeFile(storageKey, buffer);
    const asset = await deps.prisma.asset.create({
      data: {
        id,
        guildId: params.guildId,
        kind: "WELCOME_BG",
        mime: parsed.data.mime,
        sizeBytes: buffer.byteLength,
        storageKey,
        createdBy: userId,
      },
    });
    return { assetId: asset.id };
  });

  app.post("/v1/guilds/:guildId/welcome/preview", async (request, reply) => {
    const params = guildParams.parse(request.params);
    const { userId } = await authorize(deps, request, params.guildId);
    const settings = await deps.prisma.welcomeSettings.findUnique({ where: { guildId: params.guildId } });
    const user = await deps.prisma.user.findUnique({ where: { id: userId } });
    const guild = await deps.prisma.guild.findUnique({ where: { id: params.guildId } });
    if (!guild) throw validationError("Bot is not installed on this server");

    let backgroundPath: string | null = null;
    if (settings?.backgroundAssetId) {
      const asset = await deps.prisma.asset.findFirst({
        where: { id: settings.backgroundAssetId, guildId: params.guildId },
      });
      backgroundPath = asset?.storageKey ?? null;
    }

    const jobId = randomUUID();
    await deps.redis.lpush(
      WELCOME_QUEUE,
      JSON.stringify({
        kind: "preview",
        jobId,
        guildId: params.guildId,
        userId,
        username: user?.globalName ?? user?.username ?? "Preview",
        avatarUrl: user?.avatar
          ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256`
          : null,
        guildName: guild.name,
        memberCount: guild.memberCount ?? 1,
        textColor: settings?.textColor ?? "#FFFFFF",
        accentColor: settings?.accentColor ?? "#7C5CFF",
        avatarX: settings?.avatarX ?? 0.5,
        avatarY: settings?.avatarY ?? 0.35,
        nameX: settings?.nameX ?? 0.5,
        nameY: settings?.nameY ?? 0.62,
        customText: settings?.customText ?? "Willkommen",
        backgroundPath,
      }),
    );
    const result = await deps.redis.brpop(welcomeResultKey(jobId), 8);
    if (!result?.[1] || result[1] === "error") {
      return reply.status(503).send({
        error: { code: "INTERNAL", message: "Welcome worker unavailable", details: [] },
      });
    }
    const png = Buffer.from(result[1], "base64");
    return reply.type("image/png").send(png);
  });
}
