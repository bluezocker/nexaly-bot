import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@nexaly/database";
import { SESSION_TTL_SECONDS } from "@nexaly/config";
import type Redis from "ioredis";
import { oauthTokenKey } from "../redis.js";

export function createSessionId(): string {
  return randomBytes(32).toString("hex");
}

export async function persistSession(input: {
  prisma: PrismaClient;
  redis: Redis;
  userId: string;
  accessToken: string;
  expiresInSec: number;
}): Promise<{ id: string; expiresAt: Date }> {
  const id = createSessionId();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  await input.prisma.session.create({ data: { id, userId: input.userId, expiresAt } });
  await input.redis.set(
    oauthTokenKey(id),
    input.accessToken,
    "EX",
    Math.min(input.expiresInSec, SESSION_TTL_SECONDS),
  );
  return { id, expiresAt };
}

export async function destroySession(input: {
  prisma: PrismaClient;
  redis: Redis;
  sessionId: string;
}): Promise<void> {
  await Promise.all([
    input.prisma.session.deleteMany({ where: { id: input.sessionId } }),
    input.redis.del(oauthTokenKey(input.sessionId)),
  ]);
}

export async function getActiveSession(prisma: PrismaClient, sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { userId: true, expiresAt: true },
  });
  if (!session || session.expiresAt.getTime() < Date.now()) return null;
  return { userId: session.userId };
}
