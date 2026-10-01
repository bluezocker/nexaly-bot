import { describe, expect, it } from "vitest";
import {
  logSettingsUpdateSchema,
  pickAuditExecutor,
  truncateEmbed,
  type AuditCandidate,
} from "../src/logs.js";

const now = 1_000_000;

function entry(partial: Partial<AuditCandidate>): AuditCandidate {
  return {
    action: "MemberKick",
    targetId: "111",
    executorId: "222",
    createdAt: now - 400,
    ...partial,
  };
}

describe("pickAuditExecutor", () => {
  it("returns the executor when exactly one entry matches", () => {
    expect(
      pickAuditExecutor([entry({})], {
        action: "MemberKick",
        targetId: "111",
        now,
        windowMs: 10_000,
      }),
    ).toBe("222");
  });

  it("returns null when two matching entries exist", () => {
    expect(
      pickAuditExecutor([entry({}), entry({ executorId: "333" })], {
        action: "MemberKick",
        targetId: "111",
        now,
        windowMs: 10_000,
      }),
    ).toBeNull();
  });

  it("returns null when the target differs", () => {
    expect(
      pickAuditExecutor([entry({ targetId: "999" })], {
        action: "MemberKick",
        targetId: "111",
        now,
        windowMs: 10_000,
      }),
    ).toBeNull();
  });

  it("returns null when the entry is outside the window", () => {
    expect(
      pickAuditExecutor([entry({ createdAt: now - 60_000 })], {
        action: "MemberKick",
        targetId: "111",
        now,
        windowMs: 10_000,
      }),
    ).toBeNull();
  });

  it("returns null without an executor id", () => {
    expect(
      pickAuditExecutor([entry({ executorId: null })], {
        action: "MemberKick",
        targetId: "111",
        now,
        windowMs: 10_000,
      }),
    ).toBeNull();
  });
});

describe("truncateEmbed", () => {
  it("keeps short text", () => {
    expect(truncateEmbed("ok", 10)).toBe("ok");
  });

  it("truncates long text with an ellipsis", () => {
    expect(truncateEmbed("abcdefghij", 6)).toBe("abcde…");
  });
});

describe("logSettingsUpdateSchema", () => {
  it("rejects unknown event keys and extra fields", () => {
    const parsed = logSettingsUpdateSchema.safeParse({
      enabled: true,
      events: { notARealEvent: { enabled: true, channelId: null } },
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts a valid partial event map", () => {
    const parsed = logSettingsUpdateSchema.safeParse({
      enabled: true,
      events: {
        messageDelete: { enabled: true, channelId: "123456789012345678" },
      },
    });
    expect(parsed.success).toBe(true);
  });
});
