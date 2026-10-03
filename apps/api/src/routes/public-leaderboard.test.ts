import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { registerPublicRoutes } from "./public.js";

const GUILD = "111111111111111111";

async function setup(publicLeaderboard: boolean) {
  const store = new Map<string, string>();
  let dbReads = 0;
  const settings = { enabled: true, publicLeaderboard };
  const deps = {
    redis: {
      get: async (key: string) => store.get(key) ?? null,
      set: async (key: string, value: string) => {
        store.set(key, value);
        return "OK";
      },
    },
    prisma: {
      guild: {
        findUnique: async () => {
          dbReads += 1;
          return { name: "Testserver", icon: null, botJoinedAt: new Date() };
        },
      },
      guildModule: { findUnique: async () => ({ enabled: true }) },
      levelSettings: { findUnique: async () => settings },
      memberLevel: {
        findMany: async () => [{ xp: 200, displayName: "Alex", avatarUrl: null }],
        count: async () => 1,
      },
    },
  };
  const app = Fastify();
  await registerPublicRoutes(app, deps as never);
  return { app, store, settings, reads: () => dbReads };
}

describe("GET /v1/public/leaderboard/:guildId", () => {
  it("liefert die freigegebene Rangliste und nutzt danach den Cache", async () => {
    const { app, reads } = await setup(true);
    const first = await app.inject({ url: `/v1/public/leaderboard/${GUILD}` });
    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({ guild: { name: "Testserver" }, total: 1, entries: [{ rank: 1, name: "Alex" }] });
    await app.inject({ url: `/v1/public/leaderboard/${GUILD}` });
    expect(reads()).toBe(1);
  });

  it("antwortet mit 404, wenn die Rangliste nicht freigegeben ist, und merkt sich das kurz", async () => {
    const { app, reads } = await setup(false);
    expect((await app.inject({ url: `/v1/public/leaderboard/${GUILD}` })).statusCode).toBe(404);
    expect((await app.inject({ url: `/v1/public/leaderboard/${GUILD}` })).statusCode).toBe(404);
    expect(reads()).toBe(1);
  });

  it("antwortet bei ungültiger ID mit 404, ohne die Datenbank zu fragen", async () => {
    const { app, reads } = await setup(true);
    expect((await app.inject({ url: "/v1/public/leaderboard/abc" })).statusCode).toBe(404);
    expect((await app.inject({ url: "/v1/public/leaderboard/123" })).statusCode).toBe(404);
    expect(reads()).toBe(0);
  });
});
