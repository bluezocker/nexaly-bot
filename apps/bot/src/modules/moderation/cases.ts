import { prisma } from "@nexaly/database";
import type { ModAction } from "@nexaly/database";

export async function createCase(input: {
  guildId: string;
  targetId: string;
  moderatorId: string;
  action: ModAction;
  reason?: string | null;
  durationSec?: number | null;
}): Promise<{ id: string; caseNumber: number }> {
  return prisma.$transaction(async (tx) => {
    const last = await tx.moderationCase.findFirst({
      where: { guildId: input.guildId },
      orderBy: { caseNumber: "desc" },
      select: { caseNumber: true },
    });
    const caseNumber = (last?.caseNumber ?? 0) + 1;
    const expiresAt =
      input.durationSec && input.durationSec > 0
        ? new Date(Date.now() + input.durationSec * 1000)
        : null;
    const created = await tx.moderationCase.create({
      data: {
        guildId: input.guildId,
        caseNumber,
        targetId: input.targetId,
        moderatorId: input.moderatorId,
        action: input.action,
        reason: input.reason ?? null,
        durationSec: input.durationSec ?? null,
        expiresAt,
      },
    });
    if (input.action === "WARN") {
      await tx.warning.create({
        data: {
          guildId: input.guildId,
          userId: input.targetId,
          caseId: created.id,
        },
      });
    }
    return { id: created.id, caseNumber: created.caseNumber };
  });
}

export async function countWarnings(guildId: string, userId: string): Promise<number> {
  return prisma.warning.count({ where: { guildId, userId } });
}

export async function listWarnings(guildId: string, userId: string) {
  return prisma.warning.findMany({
    where: { guildId, userId },
    include: { case: true },
    orderBy: { createdAt: "desc" },
    take: 15,
  });
}
