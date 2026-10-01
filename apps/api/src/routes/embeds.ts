import {
  embedSendSchema,
  embedTemplateSchema,
  existingReactionSchema,
  notFound,
  toDiscordEmbed,
  validationError,
} from "@nexaly/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppDeps } from "../app.js";
import { requireDiscordToken, requireUser } from "../app.js";
import { fetchGuildChannels, sendChannelMessage, addBotReaction, fetchChannelMessage, TEXT_CHANNEL_TYPES, fetchGuildRoles, missingEmbedPermissions } from "../services/discord-bot-rest.js";
import { fetchCurrentUserGuilds } from "../services/discord-oauth.js";
import { ensureGuildAccess } from "../services/guilds.js";

const guildParams = z.object({ guildId: z.string().regex(/^\d{17,20}$/) });
const templateParams = guildParams.extend({ templateId: z.string().min(1) });

function messageRef(raw: string, guildId: string, fallbackChannel?: string): { channelId: string; messageId: string } {
  const link = raw.trim().match(/channels\/(\d{17,20})\/(\d{17,20})\/(\d{17,20})/);
  if (link?.[1] && link[2] && link[3]) {
    if (link[1] !== guildId) throw validationError("Die Nachricht ist von einem anderen Server");
    return { channelId: link[2], messageId: link[3] };
  }
  if (/^\d{17,20}$/.test(raw.trim()) && fallbackChannel) {
    return { channelId: fallbackChannel, messageId: raw.trim() };
  }
  throw validationError("Nachrichten-Link oder Nachrichten-ID mit Kanal angeben");
}

async function assertAssignableRole(token: string, guildId: string, roleId: string): Promise<void> {
  const roles = await fetchGuildRoles(token, guildId);
  const role = roles.find((item) => item.id === roleId);
  if (!role || role.id === guildId || role.managed) throw validationError("Role cannot be assigned");
  if ((BigInt(role.permissions) & 8n) === 8n) {
    throw validationError("Administrator roles cannot be given by reaction");
  }
}
async function authorize(deps: AppDeps, request: Parameters<typeof requireUser>[0], guildId: string) {
  const { userId, sessionId } = await requireUser(request);
  const accessToken = await requireDiscordToken(deps.redis, sessionId);
  const oauthGuilds = await fetchCurrentUserGuilds(deps.redis, userId, accessToken);
  await ensureGuildAccess({ prisma: deps.prisma, userId, guildId, oauthGuilds });
  return { userId };
}

export async function registerEmbedRoutes(app: FastifyInstance, deps: AppDeps): Promise<void> {
  app.get("/v1/guilds/:guildId/embeds", async (request) => {
    const params = guildParams.parse(request.params);
    await authorize(deps, request, params.guildId);
    const templates = await deps.prisma.embedTemplate.findMany({
      where: { guildId: params.guildId },
      orderBy: { updatedAt: "desc" },
    });
    let bindings: { id: string; channelId: string; messageId: string; emoji: string; roleId: string }[] = [];
    try {
      const rows = await deps.prisma.reactionRole.findMany({
        where: { guildId: params.guildId },
        orderBy: { createdAt: "desc" },
        take: 40,
      });
      bindings = rows.map((row) => ({
        id: row.id,
        channelId: row.channelId,
        messageId: row.messageId,
        emoji: row.emoji,
        roleId: row.roleId,
      }));
    } catch (error) {
      console.error("[embeds] reaction roles unavailable", error);
    }
    return {
      templates: templates.map((template) => ({
        id: template.id,
        name: template.name,
        content: template.content,
        embed: template.embed,
      })),
      bindings,
    };
  });

  app.post("/v1/guilds/:guildId/embeds", async (request) => {
    const params = guildParams.parse(request.params);
    const { userId } = await authorize(deps, request, params.guildId);
    const parsed = embedTemplateSchema.safeParse(request.body);
    if (!parsed.success) throw validationError("Invalid embed", parsed.error.issues);
    const template = await deps.prisma.embedTemplate.create({
      data: {
        guildId: params.guildId,
        name: parsed.data.name,
        content: parsed.data.content,
        embed: parsed.data.embed,
        updatedBy: userId,
      },
    });
    return { template };
  });

  app.put("/v1/guilds/:guildId/embeds/:templateId", async (request) => {
    const params = templateParams.parse(request.params);
    const { userId } = await authorize(deps, request, params.guildId);
    const parsed = embedTemplateSchema.safeParse(request.body);
    if (!parsed.success) throw validationError("Invalid embed", parsed.error.issues);
    const updated = await deps.prisma.embedTemplate.updateMany({
      where: { id: params.templateId, guildId: params.guildId },
      data: {
        name: parsed.data.name,
        content: parsed.data.content,
        embed: parsed.data.embed,
        updatedBy: userId,
      },
    });
    if (!updated.count) throw notFound("Template not found");
    return { ok: true };
  });

  app.delete("/v1/guilds/:guildId/embeds/:templateId", async (request) => {
    const params = templateParams.parse(request.params);
    await authorize(deps, request, params.guildId);
    const deleted = await deps.prisma.embedTemplate.deleteMany({
      where: { id: params.templateId, guildId: params.guildId },
    });
    if (!deleted.count) throw notFound("Template not found");
    return { ok: true };
  });

  app.post("/v1/guilds/:guildId/embeds/send", async (request) => {
    const params = guildParams.parse(request.params);
    await authorize(deps, request, params.guildId);
    const parsed = embedSendSchema.safeParse(request.body);
    if (!parsed.success) throw validationError("Invalid send payload", parsed.error.issues);
    if (!deps.env.DISCORD_TOKEN) throw validationError("Bot token missing on API");

    const channels = await fetchGuildChannels(deps.env.DISCORD_TOKEN, params.guildId);
    const target = channels.find((channel) => channel.id === parsed.data.channelId);
    if (!target || !TEXT_CHANNEL_TYPES.has(target.type)) {
      throw validationError("Channel is not a text channel of this guild");
    }

    let embed = parsed.data.embed;
    let content = parsed.data.content;
    if (parsed.data.templateId) {
      const template = await deps.prisma.embedTemplate.findFirst({
        where: { id: parsed.data.templateId, guildId: params.guildId },
      });
      if (!template) throw notFound("Template not found");
      embed = template.embed as typeof embed;
      content = content ?? template.content ?? undefined;
    }
    if (!embed) throw validationError("Embed missing");

    const reactions = parsed.data.reactions ?? [];
    if (reactions.length) {
      for (const reaction of reactions) {
        await assertAssignableRole(deps.env.DISCORD_TOKEN, params.guildId, reaction.roleId);
      }
    }

    const missing = await missingEmbedPermissions(
      deps.env.DISCORD_TOKEN,
      params.guildId,
      parsed.data.channelId,
    ).catch((error: unknown) => {
      if (error instanceof Error && error.name === "AppError") throw error;
      return [] as string[];
    });
    if (missing.length) {
      throw validationError(`Dem Bot fehlen in diesem Kanal: ${missing.join(", ")}.`);
    }

    const messageId = await sendChannelMessage(deps.env.DISCORD_TOKEN, parsed.data.channelId, {
      content: content?.trim() ? content : undefined,
      embeds: [toDiscordEmbed(embed)],
      allowed_mentions: { parse: [] },
    });

    const warnings: string[] = [];
    const created = [];
    for (const reaction of reactions) {
      const row = await deps.prisma.reactionRole.upsert({
        where: { messageId_emoji: { messageId, emoji: reaction.emoji } },
        create: {
          guildId: params.guildId,
          channelId: parsed.data.channelId,
          messageId,
          emoji: reaction.emoji,
          roleId: reaction.roleId,
        },
        update: { roleId: reaction.roleId, channelId: parsed.data.channelId },
      });
      created.push(row);
      try {
        await addBotReaction(deps.env.DISCORD_TOKEN, parsed.data.channelId, messageId, reaction.emoji);
      } catch (error) {
        warnings.push(error instanceof Error ? error.message : "Reaktion fehlgeschlagen");
      }
      await new Promise((resolve) => setTimeout(resolve, 400));
    }

    return { ok: true, messageId, warnings, bindings: created };
  });

  app.post("/v1/guilds/:guildId/embeds/reactions", async (request) => {
    const params = guildParams.parse(request.params);
    await authorize(deps, request, params.guildId);
    const parsed = existingReactionSchema.safeParse(request.body);
    if (!parsed.success) throw validationError("Invalid reaction role", parsed.error.issues);
    if (!deps.env.DISCORD_TOKEN) throw validationError("Bot token missing on API");
    const ref = messageRef(parsed.data.message, params.guildId, parsed.data.channelId);
    const message = await fetchChannelMessage(deps.env.DISCORD_TOKEN, ref.channelId, ref.messageId);
    if (!message) throw notFound("Nachricht nicht gefunden");
    const warnings: string[] = [];
    const bindings = [];
    for (const reaction of parsed.data.reactions) {
      await assertAssignableRole(deps.env.DISCORD_TOKEN, params.guildId, reaction.roleId);
      const row = await deps.prisma.reactionRole.upsert({
        where: { messageId_emoji: { messageId: ref.messageId, emoji: reaction.emoji } },
        create: {
          guildId: params.guildId,
          channelId: ref.channelId,
          messageId: ref.messageId,
          emoji: reaction.emoji,
          roleId: reaction.roleId,
        },
        update: { roleId: reaction.roleId, channelId: ref.channelId, guildId: params.guildId },
      });
      bindings.push({
        id: row.id,
        channelId: row.channelId,
        messageId: row.messageId,
        emoji: row.emoji,
        roleId: row.roleId,
      });
      try {
        await addBotReaction(deps.env.DISCORD_TOKEN, ref.channelId, ref.messageId, reaction.emoji);
      } catch (error) {
        warnings.push(error instanceof Error ? error.message : "Reaktion fehlgeschlagen");
      }
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    return { bindings, warnings };
  });

  app.delete("/v1/guilds/:guildId/embeds/reactions/:bindingId", async (request) => {
    const params = guildParams.extend({ bindingId: z.string().min(1) }).parse(request.params);
    await authorize(deps, request, params.guildId);
    const deleted = await deps.prisma.reactionRole.deleteMany({
      where: { id: params.bindingId, guildId: params.guildId },
    });
    if (!deleted.count) throw notFound("Reaction role not found");
    return { ok: true };
  });
}
