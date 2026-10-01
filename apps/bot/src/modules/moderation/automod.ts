import type { Client, Message } from "discord.js";
import type Redis from "ioredis";
import {
  detectCaps,
  detectDuplicate,
  detectEmoji,
  detectFlood,
  detectLinks,
  detectMentions,
  matchWordRule,
  nextLadderAction,
  normalizeForDuplicate,
  type DetectorHit,
  type ModActionName,
} from "@nexaly/shared";
import { applyAction } from "./actions.js";
import { countWarnings } from "./cases.js";
import { getModerationConfig } from "./config.js";
import { recordHash, recordTimestamp } from "./windows.js";

function shouldIgnore(message: Message, ignoreRoleIds: string[], ignoreChannelIds: string[]): boolean {
  if (!message.guild || !message.member) return true;
  if (message.author.bot) return true;
  if (ignoreChannelIds.includes(message.channelId)) return true;
  if (message.member.roles.cache.some((role) => ignoreRoleIds.includes(role.id))) return true;
  if (message.member.permissions.has("ManageMessages") || message.member.permissions.has("Administrator")) {
    return true;
  }
  return false;
}

export function bindAutomod(client: Client, redis: Redis): void {
  client.on("messageCreate", async (message) => {
    try {
      await handleMessage(client, redis, message);
    } catch (error) {
      console.error("automod", error);
    }
  });
}

async function handleMessage(client: Client, redis: Redis, message: Message): Promise<void> {
  if (!message.inGuild() || !message.member) return;
  const config = await getModerationConfig(message.guild.id);
  if (!config.moduleEnabled || !config.settings?.enabled) return;
  const settings = config.settings;
  if (shouldIgnore(message, settings.ignoreRoleIds, settings.ignoreChannelIds)) return;

  const now = Date.now();
  const hits: DetectorHit[] = [];

  if (settings.spamEnabled) {
    const stamps = await recordTimestamp(
      redis,
      `mod:flood:${message.guild.id}:${message.author.id}`,
      now,
      settings.spamMessages + 5,
      settings.spamWindowSec + 5,
    );
    const flood = detectFlood(stamps, now, settings.spamWindowSec, settings.spamMessages);
    if (flood) hits.push(flood);
  }

  if (settings.duplicateEnabled) {
    const hash = normalizeForDuplicate(message.content);
    if (hash.length > 0) {
      const hashes = await recordHash(
        redis,
        `mod:dup:${message.guild.id}:${message.author.id}`,
        hash,
        settings.duplicateCount + 5,
        30,
      );
      const dup = detectDuplicate(hash, hashes.slice(1), settings.duplicateCount);
      if (dup) hits.push(dup);
    }
  }

  const mentionCount = message.mentions.users.size + message.mentions.roles.size;
  const mentions = detectMentions(mentionCount, settings.mentionLimit);
  if (mentions) hits.push(mentions);

  const emoji = detectEmoji(message.content, settings.emojiLimit);
  if (emoji) hits.push(emoji);

  const caps = detectCaps(message.content, settings.capsPercent, settings.capsMinLength);
  if (caps) hits.push(caps);

  const links = detectLinks({
    content: message.content,
    inviteBlock: settings.inviteBlock,
    allowedDomains: settings.allowedDomains,
    blockedDomains: settings.blockedDomains,
    linkLimit: settings.linkSpamLimit,
  });
  if (links) hits.push(links);

  let ruleAction: { action: ModActionName; durationSec: number | null; reason: string } | null = null;
  for (const rule of config.rules) {
    if (rule.exceptChannelIds.includes(message.channelId)) continue;
    if (message.member.roles.cache.some((role) => rule.exceptRoleIds.includes(role.id))) continue;
    const applies =
      rule.type === "WORD" || rule.type === "CUSTOM"
        ? matchWordRule(message.content, rule)
        : rule.type === "INVITE"
          ? detectLinks({
              content: message.content,
              inviteBlock: true,
              allowedDomains: [],
              blockedDomains: [],
              linkLimit: 99,
            })?.key === "invite"
          : rule.type === "DOMAIN"
            ? detectLinks({
                content: message.content,
                inviteBlock: false,
                allowedDomains: [],
                blockedDomains: [rule.pattern],
                linkLimit: 99,
              })?.key === "blocked_domain"
            : false;
    if (applies) {
      ruleAction = {
        action: rule.action,
        durationSec: rule.durationSec,
        reason: `Regel ${rule.pattern}`,
      };
      break;
    }
  }

  if (hits.length === 0 && !ruleAction) return;

  try {
    await message.delete();
  } catch {
    /* missing manage messages */
  }

  const warnings = await countWarnings(message.guild.id, message.author.id);
  const ladder = ruleAction
    ? { action: ruleAction.action, durationSec: ruleAction.durationSec }
    : nextLadderAction(warnings, config.ladder);

  const reason = ruleAction?.reason ?? hits.map((hit) => hit.reason).join(", ");
  const result = await applyAction({
    client,
    guild: message.guild,
    target: message.member,
    moderatorId: client.user?.id ?? "0",
    action: ladder.action,
    reason: `Auto-Mod: ${reason}`,
    durationSec: ladder.durationSec,
  });

  if ("caseNumber" in result) {
    await message.channel.send({
      content: `${message.author} Auto-Mod (${hits[0]?.key ?? "rule"}) · Case #${result.caseNumber}`,
    }).catch(() => undefined);
  }
}
