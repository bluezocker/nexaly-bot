import { prisma } from "@nexaly/database";
import type { Client, EmbedBuilder, Guild } from "discord.js";
import type { LogEventKey } from "@nexaly/shared";
import { getLogConfig, isEventEnabled } from "./config.js";

export async function emitLog(input: {
  client: Client;
  guild: Guild;
  key: LogEventKey;
  embed: EmbedBuilder;
  payload: Record<string, unknown>;
  actorId?: string | null;
  storeMessageContent?: boolean;
}): Promise<void> {
  const config = await getLogConfig(input.guild.id);
  const channelId = isEventEnabled(config, input.key);
  if (!channelId) return;

  const days =
    input.key === "messageDelete" || input.key === "messageUpdate"
      ? config.deletedMessageLogDays
      : config.retentionDays;
  const expiresAt = new Date(Date.now() + Math.max(days, 1) * 24 * 60 * 60 * 1000);

  const payload = input.storeMessageContent
    ? input.payload
    : Object.fromEntries(
        Object.entries(input.payload).filter(([key]) => key !== "content" && key !== "before" && key !== "after"),
      );

  await prisma.logEvent.create({
    data: {
      guildId: input.guild.id,
      eventKey: input.key,
      payload,
      actorId: input.actorId ?? null,
      expiresAt,
    },
  });

  const channel = input.guild.channels.cache.get(channelId) ?? (await input.client.channels.fetch(channelId).catch(() => null));
  if (!channel || !channel.isTextBased() || channel.isDMBased()) return;

  try {
    await channel.send({ embeds: [input.embed] });
  } catch {
    /* missing permission or deleted channel — do not throw into the gateway handler */
  }
}

export async function pruneExpiredLogs(): Promise<number> {
  const result = await prisma.logEvent.deleteMany({
    where: { expiresAt: { lte: new Date() } },
  });
  return result.count;
}
