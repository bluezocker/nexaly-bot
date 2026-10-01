CREATE TABLE "EmbedTemplate" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT,
    "embed" JSONB NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmbedTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmbedTemplate_guildId_updatedAt_idx" ON "EmbedTemplate"("guildId", "updatedAt");
ALTER TABLE "EmbedTemplate" ADD CONSTRAINT "EmbedTemplate_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
