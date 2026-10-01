import { describe, expect, it } from "vitest";
import { canModerate } from "./hierarchy.js";

function member(input: { id: string; ownerId: string; position: number; bot?: boolean }) {
  return {
    id: input.id,
    user: { bot: input.bot ?? false },
    guild: { ownerId: input.ownerId },
    roles: { highest: { position: input.position } },
  } as never;
}

describe("canModerate", () => {
  const owner = "1";
  const bot = member({ id: "bot", ownerId: owner, position: 8, bot: true });

  it("refuses the guild owner", () => {
    const actor = member({ id: "mod", ownerId: owner, position: 10 });
    const target = member({ id: owner, ownerId: owner, position: 0 });
    expect(canModerate(actor, target, bot).allowed).toBe(false);
  });

  it("refuses self and the bot", () => {
    const actor = member({ id: "mod", ownerId: owner, position: 10 });
    expect(canModerate(actor, actor, bot).allowed).toBe(false);
    expect(canModerate(actor, bot, bot).allowed).toBe(false);
  });

  it("refuses when the bot role is not above the target", () => {
    const actor = member({ id: "mod", ownerId: owner, position: 10 });
    const target = member({ id: "user", ownerId: owner, position: 9 });
    expect(canModerate(actor, target, bot).message).toMatch(/nicht hoch genug/);
  });

  it("allows a higher human role when the bot is also higher", () => {
    const actor = member({ id: "mod", ownerId: owner, position: 10 });
    const target = member({ id: "user", ownerId: owner, position: 2 });
    expect(canModerate(actor, target, bot).allowed).toBe(true);
  });
});
