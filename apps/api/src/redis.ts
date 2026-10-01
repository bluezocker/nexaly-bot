import Redis from "ioredis";

export function createRedis(url: string): Redis {
  return new Redis(url, { maxRetriesPerRequest: 3 });
}

export const oauthTokenKey = (sessionId: string) => `session:${sessionId}:discord`;
export const oauthStateKey = (state: string) => `oauth:state:${state}`;
