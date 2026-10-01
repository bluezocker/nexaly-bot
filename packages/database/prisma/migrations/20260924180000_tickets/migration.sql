CREATE TABLE "TicketSettings" (
    "guildId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "panelChannelId" TEXT,
    "categoryId" TEXT,
    "staffRoleId" TEXT,
    "logChannelId" TEXT,
    "panelTitle" TEXT NOT NULL DEFAULT 'Support',
    "panelText" TEXT NOT NULL DEFAULT 'Klicke auf den Button, um ein Ticket zu öffnen.',
    "openMessage" TEXT NOT NULL DEFAULT 'Beschreibe dein Anliegen. Ein Teammitglied meldet sich.',

    CONSTRAINT "TicketSettings_pkey" PRIMARY KEY ("guildId")
);

CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "channelId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Ticket_channelId_key" ON "Ticket"("channelId");
CREATE UNIQUE INDEX "Ticket_guildId_number_key" ON "Ticket"("guildId", "number");
CREATE INDEX "Ticket_guildId_status_idx" ON "Ticket"("guildId", "status");

ALTER TABLE "TicketSettings" ADD CONSTRAINT "TicketSettings_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
