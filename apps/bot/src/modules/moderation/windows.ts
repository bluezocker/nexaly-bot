import type Redis from "ioredis";

export async function recordTimestamp(
  redis: Redis,
  key: string,
  now: number,
  keep: number,
  ttlSec: number,
): Promise<number[]> {
  await redis.lpush(key, String(now));
  await redis.ltrim(key, 0, keep);
  await redis.expire(key, ttlSec);
  const raw = await redis.lrange(key, 0, keep);
  return raw.map((value) => Number(value)).filter((value) => Number.isFinite(value));
}

export async function recordHash(
  redis: Redis,
  key: string,
  hash: string,
  keep: number,
  ttlSec: number,
): Promise<string[]> {
  await redis.lpush(key, hash);
  await redis.ltrim(key, 0, keep);
  await redis.expire(key, ttlSec);
  return redis.lrange(key, 0, keep);
}
