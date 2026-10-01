import { describe, expect, it } from "vitest";
import { guildForbidden, notFound, unauthorized, validationError } from "../src/index.js";

describe("AppError helpers", () => {
  it("uses stable codes and HTTP status", () => {
    expect(unauthorized().statusCode).toBe(401);
    expect(guildForbidden().code).toBe("GUILD_FORBIDDEN");
    expect(notFound().statusCode).toBe(404);
    const err = validationError("bad", [{ path: "xpMin" }]);
    expect(err.statusCode).toBe(400);
    expect(err.details).toEqual([{ path: "xpMin" }]);
  });
});
