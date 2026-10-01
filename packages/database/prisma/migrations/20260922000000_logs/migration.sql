CREATE TABLE "LogSettings" (
    "guildId" TEXT NOT NULL,
    CONSTRAINT "LogSettings_pkey" PRIMARY KEY ("guildId")
);

CREATE TABLE "LogEventSetting" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "channelId" TEXT,
    CONSTRAINT "LogEventSetting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LogEvent" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    CONSTRAINT "LogEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LogEventSetting_guildId_eventKey_key" ON "LogEventSetting"("guildId", "eventKey");
CREATE INDEX "LogEvent_guildId_eventKey_createdAt_idx" ON "LogEvent"("guildId", "eventKey", "createdAt");
CREATE INDEX "LogEvent_expiresAt_idx" ON "LogEvent"("expiresAt");

ALTER TABLE "LogSettings" ADD CONSTRAINT "LogSettings_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LogEventSetting" ADD CONSTRAINT "LogEventSetting_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LogEvent" ADD CONSTRAINT "LogEvent_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
