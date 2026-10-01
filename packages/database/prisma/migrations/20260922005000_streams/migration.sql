CREATE TYPE "StreamPlatform" AS ENUM ('TWITCH', 'YOUTUBE', 'KICK');

CREATE TABLE "StreamSubscription" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "platform" "StreamPlatform" NOT NULL,
    "channelKey" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "announceChannelId" TEXT NOT NULL,
    "mentionRoleId" TEXT,
    "template" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastLiveAt" TIMESTAMP(3),
    "lastOfflineAt" TIMESTAMP(3),
    CONSTRAINT "StreamSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StreamSubscription_guildId_platform_channelKey_key" ON "StreamSubscription"("guildId", "platform", "channelKey");
CREATE INDEX "StreamSubscription_enabled_platform_idx" ON "StreamSubscription"("enabled", "platform");
ALTER TABLE "StreamSubscription" ADD CONSTRAINT "StreamSubscription_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
