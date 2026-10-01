CREATE TYPE "WelcomeMode" AS ENUM ('TEXT', 'EMBED', 'IMAGE');
CREATE TYPE "AssetKind" AS ENUM ('WELCOME_BG', 'CUSTOM_THUMB');

CREATE TABLE "WelcomeSettings" (
    "guildId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "channelId" TEXT,
    "sendDm" BOOLEAN NOT NULL DEFAULT false,
    "dmTemplate" TEXT,
    "mode" "WelcomeMode" NOT NULL DEFAULT 'EMBED',
    "textTemplate" TEXT,
    "embedJson" JSONB,
    "backgroundAssetId" TEXT,
    "textColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "accentColor" TEXT NOT NULL DEFAULT '#7C5CFF',
    "avatarX" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "avatarY" DOUBLE PRECISION NOT NULL DEFAULT 0.35,
    "nameX" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "nameY" DOUBLE PRECISION NOT NULL DEFAULT 0.62,
    "customText" TEXT,
    CONSTRAINT "WelcomeSettings_pkey" PRIMARY KEY ("guildId")
);

CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "kind" "AssetKind" NOT NULL,
    "mime" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WelcomeSettings" ADD CONSTRAINT "WelcomeSettings_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
