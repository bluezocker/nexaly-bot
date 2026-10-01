import { randomUUID } from "node:crypto";
import { EmbedBuilder, type Client, type GuildMember } from "discord.js";
import type Redis from "ioredis";
import {
  DEFAULT_WELCOME_DM,
  DEFAULT_WELCOME_TEXT,
  WELCOME_QUEUE,
  interpolateWelcome,
  welcomeVars,
} from "@nexaly/shared";
import { getWelcomeConfig, invalidateWelcomeConfig } from "./config.js";

export { invalidateWelcomeConfig } from "./config.js";

export function registerWelcomeModule(client: Client, redis: Redis, subscriber: Redis): void {
  client.on("guildMemberAdd", (member) => {
    void handleJoin(member, redis).catch((error) => console.error("welcome", error));
  });

  subscriber.on("pmessage", (_pattern, channel, message) => {
    const match = /^guild:(.+):config$/.exec(channel);
    if (!match?.[1]) return;
    try {
      const parsed = JSON.parse(message) as { module?: string };
      if (!parsed.module || parsed.module === "welcome") invalidateWelcomeConfig(match[1]);
    } catch {
      invalidateWelcomeConfig(match[1]);
    }
  });
}

async function handleJoin(member: GuildMember, redis: Redis): Promise<void> {
  const config = await getWelcomeConfig(member.guild.id);
  if (!config?.moduleEnabled) return;

  const vars = welcomeVars({
    username: member.displayName,
    userId: member.id,
    guildName: member.guild.name,
    memberCount: member.guild.memberCount,
  });
  const text = interpolateWelcome(config.textTemplate || DEFAULT_WELCOME_TEXT, vars);

  if (config.channelId) {
    const channel = member.guild.channels.cache.get(config.channelId);
    if (channel?.isTextBased()) {
      if (config.mode === "TEXT") {
        await channel.send({ content: text });
      } else if (config.mode === "EMBED") {
        const embed = new EmbedBuilder()
          .setColor(config.embedJson?.color ?? 0x7c5cff)
          .setTitle(interpolateWelcome(config.embedJson?.title || "Willkommen", vars))
          .setDescription(interpolateWelcome(config.embedJson?.description || DEFAULT_WELCOME_TEXT, vars))
          .setThumbnail(member.user.displayAvatarURL({ size: 256 }));
        await channel.send({ embeds: [embed] });
      } else if (config.mode === "IMAGE") {
        const jobId = randomUUID();
        await redis.lpush(
          WELCOME_QUEUE,
          JSON.stringify({
            kind: "send",
            jobId,
            guildId: member.guild.id,
            channelId: config.channelId,
            userId: member.id,
            username: member.displayName,
            avatarUrl: member.user.displayAvatarURL({ size: 256, extension: "png" }),
            guildName: member.guild.name,
            memberCount: member.guild.memberCount,
            textColor: config.textColor,
            accentColor: config.accentColor,
            avatarX: config.avatarX,
            avatarY: config.avatarY,
            nameX: config.nameX,
            nameY: config.nameY,
            customText: config.customText ? interpolateWelcome(config.customText, vars) : null,
            backgroundPath: config.backgroundPath,
            caption: text,
          }),
        );
      }
    }
  }

  if (config.sendDm) {
    const dm = interpolateWelcome(config.dmTemplate || DEFAULT_WELCOME_DM, vars);
    await member.send({ content: dm }).catch(() => undefined);
  }
}
