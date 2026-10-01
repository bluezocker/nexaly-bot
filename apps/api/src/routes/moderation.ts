import {
  DEFAULT_LADDER,
  configChannel,
  moderationRuleSchema,
  moderationSettingsUpdateSchema,
  notFound,
  validationError,
} from "@nexaly/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppDeps } from "../app.js";
import { requireDiscordToken, requireUser } from "../app.js";
import { fetchCurrentUserGuilds } from "../services/discord-oauth.js";
import { ensureGuildAccess } from "../services/guilds.js";

const guildParams = z.object({ guildId: z.string().regex(/^\d{17,20}$/) });
const ruleParams = guildParams.extend({ ruleId: z.string().min(1) });

async function authorize(deps: AppDeps, request: Parameters<typeof requireUser>[0], guildId: string) {
  const { userId, sessionId } = await requireUser(request);
  const accessToken = await requireDiscordToken(deps.redis, sessionId);
  const oauthGuilds = await fetchCurrentUserGuilds(deps.redis, userId, accessToken);
  await ensureGuildAccess({ prisma: deps.prisma, userId, guildId, oauthGuilds });
  return { userId };
}

export async function registerModerationRoutes(app: FastifyInstance, deps: AppDeps): Promise<void> {
  app.get("/v1/guilds/:guildId/moderation", async (request) => {
    const params = guildParams.parse(request.params);
    await authorize(deps, request, params.guildId);
    const [moduleRow, settings, rules, ladder] = await Promise.all([
      deps.prisma.guildModule.findUnique({
        where: { guildId_key: { guildId: params.guildId, key: "moderation" } },
      }),
      deps.prisma.moderationSettings.findUnique({ where: { guildId: params.guildId } }),
      deps.prisma.moderationRule.findMany({ where: { guildId: params.guildId } }),
      deps.prisma.escalationLadder.findMany({
        where: { guildId: params.guildId },
        orderBy: { step: "asc" },
      }),
    ]);
    return {
      enabled: moduleRow?.enabled ?? false,
      settings: settings ?? null,
      rules,
      ladder: ladder.length ? ladder : DEFAULT_LADDER,
    };
  });

  app.put("/v1/guilds/:guildId/moderation", async (request) => {
    const params = guildParams.parse(request.params);
    const { userId } = await authorize(deps, request, params.guildId);
    const parsed = moderationSettingsUpdateSchema.safeParse(request.body);
    if (!parsed.success) throw validationError("Invalid moderation settings", parsed.error.issues);
    const guild = await deps.prisma.guild.findUnique({ where: { id: params.guildId } });
    if (!guild) throw validationError("Bot is not installed on this server");

    const data = parsed.data;
    await deps.prisma.$transaction(async (tx) => {
      await tx.guildModule.upsert({
        where: { guildId_key: { guildId: params.guildId, key: "moderation" } },
        create: { guildId: params.guildId, key: "moderation", enabled: data.enabled },
        update: { enabled: data.enabled },
      });
      await tx.moderationSettings.upsert({
        where: { guildId: params.guildId },
        create: {
          guildId: params.guildId,
          enabled: data.enabled,
          logChannelId: data.logChannelId,
          ignoreRoleIds: data.ignoreRoleIds,
          ignoreChannelIds: data.ignoreChannelIds,
          spamEnabled: data.spamEnabled,
          spamMessages: data.spamMessages,
          spamWindowSec: data.spamWindowSec,
          duplicateEnabled: data.duplicateEnabled,
          duplicateCount: data.duplicateCount,
          mentionLimit: data.mentionLimit,
          emojiLimit: data.emojiLimit,
          capsPercent: data.capsPercent,
          capsMinLength: data.capsMinLength,
          linkSpamLimit: data.linkSpamLimit,
          inviteBlock: data.inviteBlock,
          allowedDomains: data.allowedDomains,
          blockedDomains: data.blockedDomains,
          raidEnabled: data.raidEnabled,
          raidJoins: data.raidJoins,
          raidWindowSec: data.raidWindowSec,
          raidAction: data.raidAction,
          raidAlertChannelId: data.raidAlertChannelId,
          minAccountAgeHours: data.minAccountAgeHours,
        },
        update: {
          enabled: data.enabled,
          logChannelId: data.logChannelId,
          ignoreRoleIds: data.ignoreRoleIds,
          ignoreChannelIds: data.ignoreChannelIds,
          spamEnabled: data.spamEnabled,
          spamMessages: data.spamMessages,
          spamWindowSec: data.spamWindowSec,
          duplicateEnabled: data.duplicateEnabled,
          duplicateCount: data.duplicateCount,
          mentionLimit: data.mentionLimit,
          emojiLimit: data.emojiLimit,
          capsPercent: data.capsPercent,
          capsMinLength: data.capsMinLength,
          linkSpamLimit: data.linkSpamLimit,
          inviteBlock: data.inviteBlock,
          allowedDomains: data.allowedDomains,
          blockedDomains: data.blockedDomains,
          raidEnabled: data.raidEnabled,
          raidJoins: data.raidJoins,
          raidWindowSec: data.raidWindowSec,
          raidAction: data.raidAction,
          raidAlertChannelId: data.raidAlertChannelId,
          minAccountAgeHours: data.minAccountAgeHours,
        },
      });
      await tx.escalationLadder.deleteMany({ where: { guildId: params.guildId } });
      if (data.ladder.length) {
        await tx.escalationLadder.createMany({
          data: data.ladder.map((step) => ({
            guildId: params.guildId,
            step: step.step,
            action: step.action,
            durationSec: step.durationSec,
          })),
        });
      }
      await tx.auditEntry.create({
        data: { guildId: params.guildId, actorId: userId, action: "moderation.update" },
      });
    });

    await deps.redis.publish(configChannel(params.guildId), JSON.stringify({ module: "moderation" }));
    return { ok: true };
  });

  app.post("/v1/guilds/:guildId/moderation/rules", async (request) => {
    const params = guildParams.parse(request.params);
    await authorize(deps, request, params.guildId);
    const parsed = moderationRuleSchema.safeParse(request.body);
    if (!parsed.success) throw validationError("Invalid rule", parsed.error.issues);
    const rule = await deps.prisma.moderationRule.create({
      data: { guildId: params.guildId, ...parsed.data },
    });
    await deps.redis.publish(configChannel(params.guildId), JSON.stringify({ module: "moderation" }));
    return { rule };
  });

  app.delete("/v1/guilds/:guildId/moderation/rules/:ruleId", async (request) => {
    const params = ruleParams.parse(request.params);
    await authorize(deps, request, params.guildId);
    const deleted = await deps.prisma.moderationRule.deleteMany({
      where: { id: params.ruleId, guildId: params.guildId },
    });
    if (!deleted.count) throw notFound("Rule not found");
    await deps.redis.publish(configChannel(params.guildId), JSON.stringify({ module: "moderation" }));
    return { ok: true };
  });

  app.get("/v1/guilds/:guildId/moderation/cases", async (request) => {
    const params = guildParams.parse(request.params);
    await authorize(deps, request, params.guildId);
    const cases = await deps.prisma.moderationCase.findMany({
      where: { guildId: params.guildId },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    return { cases: cases.map((row) => ({
      caseNumber: row.caseNumber,
      action: row.action,
      targetId: row.targetId,
      reason: row.reason,
    })) };
  });
}
