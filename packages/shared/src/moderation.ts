import { z } from "zod";

export const MOD_ACTIONS = ["DELETE", "WARN", "TIMEOUT", "KICK", "BAN"] as const;
export type ModActionName = (typeof MOD_ACTIONS)[number];

export const MATCH_MODES = ["EXACT", "CONTAINS", "WORD_BOUNDARY", "REGEX"] as const;
export type MatchModeName = (typeof MATCH_MODES)[number];

const snowflake = z.string().regex(/^\d{17,20}$/);

export const escalationStepSchema = z.object({
  step: z.number().int().min(1).max(10),
  action: z.enum(MOD_ACTIONS),
  durationSec: z.number().int().min(0).max(28 * 24 * 3600).nullable(),
});

export const moderationSettingsUpdateSchema = z
  .object({
    enabled: z.boolean(),
    logChannelId: snowflake.nullable(),
    ignoreRoleIds: z.array(snowflake).max(25),
    ignoreChannelIds: z.array(snowflake).max(25),
    spamEnabled: z.boolean(),
    spamMessages: z.number().int().min(2).max(30),
    spamWindowSec: z.number().int().min(2).max(60),
    duplicateEnabled: z.boolean(),
    duplicateCount: z.number().int().min(2).max(15),
    mentionLimit: z.number().int().min(1).max(50),
    emojiLimit: z.number().int().min(1).max(80),
    capsPercent: z.number().int().min(50).max(100),
    capsMinLength: z.number().int().min(6).max(200),
    linkSpamLimit: z.number().int().min(1).max(20),
    inviteBlock: z.boolean(),
    allowedDomains: z.array(z.string().min(1).max(253)).max(50),
    blockedDomains: z.array(z.string().min(1).max(253)).max(50),
    raidEnabled: z.boolean(),
    raidJoins: z.number().int().min(3).max(50),
    raidWindowSec: z.number().int().min(5).max(300),
    raidAction: z.enum(["ALERT", "LOCKDOWN", "RESTRICT_NEW", "VERIFY_GATE"]),
    raidAlertChannelId: snowflake.nullable(),
    minAccountAgeHours: z.number().int().min(0).max(24 * 30).nullable(),
    ladder: z.array(escalationStepSchema).max(8),
  })
  .strict();

export const moderationRuleSchema = z
  .object({
    type: z.enum(["WORD", "INVITE", "DOMAIN", "CUSTOM"]),
    pattern: z.string().min(1).max(120),
    matchMode: z.enum(MATCH_MODES),
    action: z.enum(MOD_ACTIONS),
    durationSec: z.number().int().min(0).max(28 * 24 * 3600).nullable(),
    enabled: z.boolean(),
    exceptRoleIds: z.array(snowflake).max(25),
    exceptChannelIds: z.array(snowflake).max(25),
  })
  .strict();

export type ModerationSettingsUpdate = z.infer<typeof moderationSettingsUpdateSchema>;
export type ModerationRuleInput = z.infer<typeof moderationRuleSchema>;

export interface DetectorHit {
  key: string;
  reason: string;
}

export function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
}

export function hostMatchesList(host: string, list: string[]): boolean {
  const normalized = normalizeHost(host);
  return list.some((entry) => {
    const allowed = normalizeHost(entry);
    if (!allowed) return false;
    return normalized === allowed || normalized.endsWith(`.${allowed}`);
  });
}

const URL_PATTERN = /\bhttps?:\/\/[^\s<>]+/gi;
const INVITE_CODE = /(?:discord(?:app)?\.com\/invite|discord\.gg|discord\.new)\/([a-zA-Z0-9-]+)/i;
const CUSTOM_INVITE = /\bdiscord(?:app)?\.com\/invite\//i;

export function extractUrls(content: string): string[] {
  return content.match(URL_PATTERN) ?? [];
}

export function hostnameOf(url: string): string | null {
  try {
    return normalizeHost(new URL(url).hostname);
  } catch {
    return null;
  }
}

export function isDiscordInvite(content: string, url?: string): boolean {
  const sample = url ? `${content} ${url}` : content;
  return INVITE_CODE.test(sample) || CUSTOM_INVITE.test(sample);
}

export function detectFlood(
  timestamps: number[],
  now: number,
  windowSec: number,
  maxMessages: number,
): DetectorHit | null {
  const recent = timestamps.filter((ts) => now - ts <= windowSec * 1000);
  if (recent.length >= maxMessages) {
    return { key: "flood", reason: `${recent.length} Nachrichten in ${windowSec}s` };
  }
  return null;
}

export function detectDuplicate(hash: string, recentHashes: string[], limit: number): DetectorHit | null {
  const count = recentHashes.filter((item) => item === hash).length;
  if (count >= limit) {
    return { key: "duplicate", reason: `gleiche Nachricht ${count}×` };
  }
  return null;
}

export function detectMentions(count: number, limit: number): DetectorHit | null {
  if (count > limit) return { key: "mentions", reason: `${count} Erwähnungen` };
  return null;
}

const EMOJI_PATTERN = /<a?:\w+:\d+>|[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu;

export function detectEmoji(content: string, limit: number): DetectorHit | null {
  const count = content.match(EMOJI_PATTERN)?.length ?? 0;
  if (count > limit) return { key: "emoji", reason: `${count} Emojis` };
  return null;
}

export function detectCaps(content: string, percent: number, minLength: number): DetectorHit | null {
  const letters = content.replace(/[^A-Za-zÄÖÜäöüß]/g, "");
  if (letters.length < minLength) return null;
  const upper = letters.replace(/[^A-ZÄÖÜ]/g, "").length;
  const ratio = (upper / letters.length) * 100;
  if (ratio >= percent) return { key: "caps", reason: `${Math.round(ratio)}% Großbuchstaben` };
  return null;
}

export function detectLinks(input: {
  content: string;
  inviteBlock: boolean;
  allowedDomains: string[];
  blockedDomains: string[];
  linkLimit: number;
}): DetectorHit | null {
  const urls = extractUrls(input.content);
  if (input.inviteBlock && isDiscordInvite(input.content)) {
    return { key: "invite", reason: "Discord-Einladungslink" };
  }
  if (urls.length >= input.linkLimit) {
    return { key: "link_spam", reason: `${urls.length} Links` };
  }
  for (const url of urls) {
    const host = hostnameOf(url);
    if (!host) continue;
    if (input.inviteBlock && isDiscordInvite(input.content, url)) {
      return { key: "invite", reason: "Discord-Einladungslink" };
    }
    if (hostMatchesList(host, input.blockedDomains)) {
      return { key: "blocked_domain", reason: `blockierte Domain ${host}` };
    }
    if (input.allowedDomains.length > 0 && !hostMatchesList(host, input.allowedDomains)) {
      return { key: "allowlist", reason: `Domain nicht erlaubt: ${host}` };
    }
  }
  return null;
}

export function normalizeForDuplicate(content: string): string {
  return content.trim().toLowerCase().replace(/\s+/g, " ");
}

export function matchWordRule(
  content: string,
  rule: { pattern: string; matchMode: MatchModeName },
): boolean {
  const text = content.toLowerCase();
  const pattern = rule.pattern.toLowerCase();
  if (!pattern) return false;

  switch (rule.matchMode) {
    case "EXACT":
      return text === pattern;
    case "CONTAINS":
      return text.includes(pattern);
    case "WORD_BOUNDARY": {
      const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(?:^|\\W)${escaped}(?:$|\\W)`, "i").test(content);
    }
    case "REGEX": {
      if (rule.pattern.length > 80) return false;
      try {
        return new RegExp(rule.pattern, "i").test(content);
      } catch {
        return false;
      }
    }
    default:
      return false;
  }
}

export function nextLadderAction(
  existingWarningCount: number,
  ladder: { step: number; action: ModActionName; durationSec: number | null }[],
): { action: ModActionName; durationSec: number | null; step: number } {
  const sorted = [...ladder].sort((a, b) => a.step - b.step);
  if (sorted.length === 0) {
    return { action: "WARN", durationSec: null, step: existingWarningCount + 1 };
  }
  const index = Math.min(existingWarningCount, sorted.length - 1);
  const chosen = sorted[index] ?? sorted[0]!;
  return { action: chosen.action, durationSec: chosen.durationSec, step: chosen.step };
}

export const DEFAULT_LADDER = [
  { step: 1, action: "WARN" as const, durationSec: null },
  { step: 2, action: "TIMEOUT" as const, durationSec: 60 },
  { step: 3, action: "TIMEOUT" as const, durationSec: 600 },
  { step: 4, action: "KICK" as const, durationSec: null },
];
