CREATE TYPE "SocialPlatform" AS ENUM ('X', 'THREADS');

CREATE TABLE "SocialSubscription" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "accountKey" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "announceChannelId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastPostId" TEXT,
    "lastError" TEXT,
    "accessToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SocialSubscription_guildId_platform_accountKey_key" ON "SocialSubscription"("guildId", "platform", "accountKey");
CREATE INDEX "SocialSubscription_enabled_platform_idx" ON "SocialSubscription"("enabled", "platform");

ALTER TABLE "SocialSubscription" ADD CONSTRAINT "SocialSubscription_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
