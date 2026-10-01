CREATE TYPE "RaidAction" AS ENUM ('ALERT', 'LOCKDOWN', 'RESTRICT_NEW', 'VERIFY_GATE');
CREATE TYPE "ModerationRuleType" AS ENUM ('WORD', 'INVITE', 'DOMAIN', 'CUSTOM');
CREATE TYPE "MatchMode" AS ENUM ('EXACT', 'CONTAINS', 'REGEX', 'WORD_BOUNDARY');
CREATE TYPE "ModAction" AS ENUM ('DELETE', 'WARN', 'TIMEOUT', 'KICK', 'BAN', 'UNBAN', 'UNTIMEOUT', 'NOTE');

CREATE TABLE "ModerationSettings" (
    "guildId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "logChannelId" TEXT,
    "ignoreRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ignoreChannelIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "spamEnabled" BOOLEAN NOT NULL DEFAULT true,
    "spamMessages" INTEGER NOT NULL DEFAULT 5,
    "spamWindowSec" INTEGER NOT NULL DEFAULT 5,
    "duplicateEnabled" BOOLEAN NOT NULL DEFAULT true,
    "duplicateCount" INTEGER NOT NULL DEFAULT 3,
    "mentionLimit" INTEGER NOT NULL DEFAULT 8,
    "emojiLimit" INTEGER NOT NULL DEFAULT 12,
    "capsPercent" INTEGER NOT NULL DEFAULT 80,
    "capsMinLength" INTEGER NOT NULL DEFAULT 12,
    "linkSpamLimit" INTEGER NOT NULL DEFAULT 4,
    "inviteBlock" BOOLEAN NOT NULL DEFAULT true,
    "allowedDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "blockedDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "raidEnabled" BOOLEAN NOT NULL DEFAULT false,
    "raidJoins" INTEGER NOT NULL DEFAULT 10,
    "raidWindowSec" INTEGER NOT NULL DEFAULT 15,
    "raidAction" "RaidAction" NOT NULL DEFAULT 'ALERT',
    "raidAlertChannelId" TEXT,
    "minAccountAgeHours" INTEGER,
    CONSTRAINT "ModerationSettings_pkey" PRIMARY KEY ("guildId")
);

CREATE TABLE "ModerationRule" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "type" "ModerationRuleType" NOT NULL,
    "pattern" TEXT NOT NULL,
    "matchMode" "MatchMode" NOT NULL DEFAULT 'CONTAINS',
    "action" "ModAction" NOT NULL,
    "durationSec" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "exceptRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "exceptChannelIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    CONSTRAINT "ModerationRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModerationCase" (
    "id" TEXT NOT NULL,
    "caseNumber" INTEGER NOT NULL,
    "guildId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "action" "ModAction" NOT NULL,
    "reason" TEXT,
    "durationSec" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ModerationCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Warning" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Warning_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EscalationLadder" (
    "guildId" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "action" "ModAction" NOT NULL,
    "durationSec" INTEGER,
    CONSTRAINT "EscalationLadder_pkey" PRIMARY KEY ("guildId","step")
);

CREATE INDEX "ModerationRule_guildId_enabled_idx" ON "ModerationRule"("guildId", "enabled");
CREATE UNIQUE INDEX "ModerationCase_guildId_caseNumber_key" ON "ModerationCase"("guildId", "caseNumber");
CREATE INDEX "ModerationCase_guildId_targetId_idx" ON "ModerationCase"("guildId", "targetId");
CREATE INDEX "ModerationCase_guildId_createdAt_idx" ON "ModerationCase"("guildId", "createdAt");
CREATE INDEX "Warning_guildId_userId_idx" ON "Warning"("guildId", "userId");

ALTER TABLE "ModerationSettings" ADD CONSTRAINT "ModerationSettings_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModerationRule" ADD CONSTRAINT "ModerationRule_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModerationCase" ADD CONSTRAINT "ModerationCase_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Warning" ADD CONSTRAINT "Warning_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Warning" ADD CONSTRAINT "Warning_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ModerationCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EscalationLadder" ADD CONSTRAINT "EscalationLadder_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
