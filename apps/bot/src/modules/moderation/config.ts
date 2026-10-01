import { prisma } from "@nexaly/database";
import { DEFAULT_LADDER, type ModActionName } from "@nexaly/shared";

export interface ModerationRuntime {
  moduleEnabled: boolean;
  settings: {
    enabled: boolean;
    ignoreRoleIds: string[];
    ignoreChannelIds: string[];
    spamEnabled: boolean;
    spamMessages: number;
    spamWindowSec: number;
    duplicateEnabled: boolean;
    duplicateCount: number;
    mentionLimit: number;
    emojiLimit: number;
    capsPercent: number;
    capsMinLength: number;
    linkSpamLimit: number;
    inviteBlock: boolean;
    allowedDomains: string[];
    blockedDomains: string[];
    raidEnabled: boolean;
    raidJoins: number;
    raidWindowSec: number;
    raidAction: "ALERT" | "LOCKDOWN" | "RESTRICT_NEW" | "VERIFY_GATE";
    raidAlertChannelId: string | null;
    minAccountAgeHours: number | null;
  } | null;
  rules: {
    id: string;
    type: string;
    pattern: string;
    matchMode: "EXACT" | "CONTAINS" | "WORD_BOUNDARY" | "REGEX";
    action: ModActionName;
    durationSec: number | null;
    exceptRoleIds: string[];
    exceptChannelIds: string[];
  }[];
  ladder: { step: number; action: ModActionName; durationSec: number | null }[];
}

const cache = new Map<string, ModerationRuntime>();

export function invalidateModerationConfig(guildId: string): void {
  cache.delete(guildId);
}

export async function getModerationConfig(guildId: string): Promise<ModerationRuntime> {
  const cached = cache.get(guildId);
  if (cached) return cached;

  const [moduleRow, settings, rules, ladder] = await Promise.all([
    prisma.guildModule.findUnique({ where: { guildId_key: { guildId, key: "moderation" } } }),
    prisma.moderationSettings.findUnique({ where: { guildId } }),
    prisma.moderationRule.findMany({ where: { guildId, enabled: true } }),
    prisma.escalationLadder.findMany({ where: { guildId }, orderBy: { step: "asc" } }),
  ]);

  const runtime: ModerationRuntime = {
    moduleEnabled: moduleRow?.enabled ?? false,
    settings: settings
      ? {
          enabled: settings.enabled,
          ignoreRoleIds: settings.ignoreRoleIds,
          ignoreChannelIds: settings.ignoreChannelIds,
          spamEnabled: settings.spamEnabled,
          spamMessages: settings.spamMessages,
          spamWindowSec: settings.spamWindowSec,
          duplicateEnabled: settings.duplicateEnabled,
          duplicateCount: settings.duplicateCount,
          mentionLimit: settings.mentionLimit,
          emojiLimit: settings.emojiLimit,
          capsPercent: settings.capsPercent,
          capsMinLength: settings.capsMinLength,
          linkSpamLimit: settings.linkSpamLimit,
          inviteBlock: settings.inviteBlock,
          allowedDomains: settings.allowedDomains,
          blockedDomains: settings.blockedDomains,
          raidEnabled: settings.raidEnabled,
          raidJoins: settings.raidJoins,
          raidWindowSec: settings.raidWindowSec,
          raidAction: settings.raidAction,
          raidAlertChannelId: settings.raidAlertChannelId,
          minAccountAgeHours: settings.minAccountAgeHours,
        }
      : null,
    rules: rules.map((rule) => ({
      id: rule.id,
      type: rule.type,
      pattern: rule.pattern,
      matchMode: rule.matchMode,
      action: rule.action as ModActionName,
      durationSec: rule.durationSec,
      exceptRoleIds: rule.exceptRoleIds,
      exceptChannelIds: rule.exceptChannelIds,
    })),
    ladder:
      ladder.length > 0
        ? ladder.map((step) => ({
            step: step.step,
            action: step.action as ModActionName,
            durationSec: step.durationSec,
          }))
        : DEFAULT_LADDER,
  };
  cache.set(guildId, runtime);
  return runtime;
}
