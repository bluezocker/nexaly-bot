ALTER TABLE "LevelSettings" ADD COLUMN "publicLeaderboard" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "MemberLevel" ADD COLUMN "displayName" TEXT;
ALTER TABLE "MemberLevel" ADD COLUMN "avatarUrl" TEXT;
