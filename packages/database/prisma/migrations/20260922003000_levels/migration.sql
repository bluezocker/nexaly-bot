CREATE TABLE "LevelSettings" (
    "guildId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "xpMin" INTEGER NOT NULL DEFAULT 15,
    "xpMax" INTEGER NOT NULL DEFAULT 25,
    "cooldownSec" INTEGER NOT NULL DEFAULT 60,
    "announceChannelId" TEXT,
    "stackRoles" BOOLEAN NOT NULL DEFAULT true,
    "ignoredChannelIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ignoredRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    CONSTRAINT "LevelSettings_pkey" PRIMARY KEY ("guildId")
);

CREATE TABLE "MemberLevel" (
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 0,
    "lastXpAt" TIMESTAMP(3),
    CONSTRAINT "MemberLevel_pkey" PRIMARY KEY ("guildId","userId")
);

CREATE TABLE "LevelReward" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "roleId" TEXT NOT NULL,
    CONSTRAINT "LevelReward_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MemberLevel_guildId_xp_idx" ON "MemberLevel"("guildId", "xp");
CREATE UNIQUE INDEX "LevelReward_guildId_level_key" ON "LevelReward"("guildId", "level");

ALTER TABLE "LevelSettings" ADD CONSTRAINT "LevelSettings_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemberLevel" ADD CONSTRAINT "MemberLevel_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LevelReward" ADD CONSTRAINT "LevelReward_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
