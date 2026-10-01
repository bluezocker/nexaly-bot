import { z } from "zod";

export const STREAM_PLATFORMS = ["TWITCH", "YOUTUBE", "KICK"] as const;
export type StreamPlatform = (typeof STREAM_PLATFORMS)[number];

const snowflake = z.string().regex(/^\d{17,20}$/);

export const streamSubscriptionSchema = z
  .object({
    platform: z.enum(STREAM_PLATFORMS),
    channelKey: z.string().min(1).max(80),
    announceChannelId: snowflake,
    mentionRoleId: snowflake.nullable(),
    template: z.string().max(1800).nullable(),
    enabled: z.boolean(),
  })
  .strict();

export type StreamSubscriptionInput = z.infer<typeof streamSubscriptionSchema>;

export interface StreamChannelInfo {
  platform: StreamPlatform;
  channelKey: string;
  externalId: string;
  displayName: string;
  url: string;
}

export interface LiveStreamInfo {
  live: boolean;
  title?: string;
  game?: string;
  viewerCount?: number;
  startedAt?: string;
  url?: string;
  thumbnailUrl?: string;
}

export interface StreamProvider {
  platform: StreamPlatform;
  configured(): boolean;
  validateChannel(channelKey: string): Promise<StreamChannelInfo>;
  getLiveStatus(externalId: string): Promise<LiveStreamInfo>;
}

export const DEFAULT_STREAM_TEMPLATE =
  "{streamer} ist live auf {platform}: {title}\n{url}";

export function interpolateStream(
  template: string,
  vars: {
    streamer: string;
    platform: string;
    title: string;
    url: string;
    game?: string;
  },
): string {
  return template
    .replaceAll("{streamer}", vars.streamer)
    .replaceAll("{platform}", vars.platform)
    .replaceAll("{title}", vars.title)
    .replaceAll("{url}", vars.url)
    .replaceAll("{game}", vars.game ?? "");
}
