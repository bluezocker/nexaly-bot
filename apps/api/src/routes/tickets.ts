import { ticketSettingsSchema, validationError } from "@nexaly/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppDeps } from "../app.js";
import { requireDiscordToken, requireUser } from "../app.js";
import { sendChannelComponents } from "../services/discord-bot-rest.js";
import { fetchCurrentUserGuilds } from "../services/discord-oauth.js";
import { ensureGuildAccess } from "../services/guilds.js";

const guildParams = z.object({ guildId: z.string().regex(/^\d{17,20}$/) });

const defaults = {
  enabled: false,
  panelChannelId: null as string | null,
  categoryId: null as string | null,
  staffRoleId: null as string | null,
  logChannelId: null as string | null,
  panelTitle: "Support",
  panelText: "Klicke auf den Button, um ein Ticket zu öffnen.",
  openMessage: "Beschreibe dein Anliegen. Ein Teammitglied meldet sich.",
};

async function authorize(deps: AppDeps, request: Parameters<typeof requireUser>[0], guildId: string) {
  const { userId, sessionId } = await requireUser(request);
  const accessToken = await requireDiscordToken(deps.redis, sessionId);
  const oauthGuilds = await fetchCurrentUserGuilds(deps.redis, userId, accessToken);
  await ensureGuildAccess({ prisma: deps.prisma, userId, guildId, oauthGuilds });
  return { userId };
}

export async function registerTicketRoutes(app: FastifyInstance, deps: AppDeps): Promise<void> {
  app.get("/v1/guilds/:guildId/tickets", async (request) => {
    const params = guildParams.parse(request.params);
    await authorize(deps, request, params.guildId);
    const [settings, tickets] = await Promise.all([
      deps.prisma.ticketSettings.findUnique({ where: { guildId: params.guildId } }),
      deps.prisma.ticket.findMany({
        where: { guildId: params.guildId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);
    return {
      settings: {
        enabled: settings?.enabled ?? defaults.enabled,
        panelChannelId: settings?.panelChannelId ?? null,
        categoryId: settings?.categoryId ?? null,
        staffRoleId: settings?.staffRoleId ?? null,
        logChannelId: settings?.logChannelId ?? null,
        panelTitle: settings?.panelTitle ?? defaults.panelTitle,
        panelText: settings?.panelText ?? defaults.panelText,
        openMessage: settings?.openMessage ?? defaults.openMessage,
      },
      tickets: tickets.map((ticket) => ({
        id: ticket.id,
        number: ticket.number,
        channelId: ticket.channelId,
        ownerId: ticket.ownerId,
        status: ticket.status,
        createdAt: ticket.createdAt.toISOString(),
      })),
    };
  });

  app.put("/v1/guilds/:guildId/tickets", async (request) => {
    const params = guildParams.parse(request.params);
    const { userId } = await authorize(deps, request, params.guildId);
    const parsed = ticketSettingsSchema.safeParse(request.body);
    if (!parsed.success) {
      const hint = parsed.error.issues.map((issue) => issue.path.join(".") || issue.message).join(", ");
      throw validationError(hint ? `Ungültige Ticket-Einstellungen: ${hint}` : "Ungültige Ticket-Einstellungen");
    }
    const guild = await deps.prisma.guild.findUnique({ where: { id: params.guildId } });
    if (!guild) throw validationError("Bot is not installed on this server");
    const data = parsed.data;
    await deps.prisma.$transaction(async (tx) => {
      await tx.ticketSettings.upsert({
        where: { guildId: params.guildId },
        create: { guildId: params.guildId, ...data },
        update: data,
      });
      await tx.guildModule.upsert({
        where: { guildId_key: { guildId: params.guildId, key: "tickets" } },
        create: { guildId: params.guildId, key: "tickets", enabled: data.enabled },
        update: { enabled: data.enabled },
      });
      await tx.auditEntry.create({
        data: { guildId: params.guildId, actorId: userId, action: "tickets.update" },
      });
    });
    return { ok: true };
  });

  app.post("/v1/guilds/:guildId/tickets/panel", async (request) => {
    const params = guildParams.parse(request.params);
    await authorize(deps, request, params.guildId);
    if (!deps.env.DISCORD_TOKEN) throw validationError("Bot token missing on API");
    const settings = await deps.prisma.ticketSettings.findUnique({ where: { guildId: params.guildId } });
    if (!settings?.enabled || !settings.panelChannelId || !settings.categoryId || !settings.staffRoleId) {
      throw validationError("Aktiviere Tickets und wähle Kanal, Kategorie und Team-Rolle");
    }
    const messageId = await sendChannelComponents(deps.env.DISCORD_TOKEN, settings.panelChannelId, {
      embeds: [
        {
          title: settings.panelTitle,
          description: settings.panelText,
          color: 0x7c5cff,
        },
      ],
      components: [
        {
          type: 1,
          components: [
            { type: 2, style: 1, label: "Ticket öffnen", custom_id: "ticket:open" },
          ],
        },
      ],
    });
    return { ok: true, messageId };
  });
}
