import { describe, expect, it } from "vitest";
import {
  detectCaps,
  detectDuplicate,
  detectFlood,
  detectLinks,
  detectMentions,
  hostMatchesList,
  matchWordRule,
  nextLadderAction,
  normalizeForDuplicate,
} from "../src/moderation.js";

describe("automod detectors", () => {
  it("detects message flooding", () => {
    const now = 10_000;
    expect(detectFlood([9000, 9200, 9400, 9600, 9800], now, 5, 5)?.key).toBe("flood");
    expect(detectFlood([9000], now, 5, 5)).toBeNull();
  });

  it("detects repeated identical messages", () => {
    const hash = normalizeForDuplicate("Hallo Welt");
    expect(detectDuplicate(hash, [hash, hash, hash], 3)?.key).toBe("duplicate");
    expect(detectDuplicate(hash, [hash], 3)).toBeNull();
  });

  it("detects mention and caps spam", () => {
    expect(detectMentions(9, 8)?.key).toBe("mentions");
    expect(detectCaps("THIS IS VERY LOUD TEXT", 80, 8)?.key).toBe("caps");
    expect(detectCaps("Hello world this is fine", 80, 8)).toBeNull();
  });

  it("blocks discord invites without labeling random urls as malware", () => {
    expect(
      detectLinks({
        content: "join https://discord.gg/abc123",
        inviteBlock: true,
        allowedDomains: [],
        blockedDomains: [],
        linkLimit: 10,
      })?.key,
    ).toBe("invite");
    expect(
      detectLinks({
        content: "see https://example.com/docs",
        inviteBlock: true,
        allowedDomains: [],
        blockedDomains: [],
        linkLimit: 10,
      }),
    ).toBeNull();
  });

  it("matches allow and block lists on the hostname", () => {
    expect(hostMatchesList("cdn.example.com", ["example.com"])).toBe(true);
    expect(hostMatchesList("example.com.evil.test", ["example.com"])).toBe(false);
  });

  it("matches word rules", () => {
    expect(matchWordRule("das ist verboten hier", { pattern: "verboten", matchMode: "CONTAINS" })).toBe(true);
    expect(matchWordRule("unverboten", { pattern: "verboten", matchMode: "WORD_BOUNDARY" })).toBe(false);
  });

  it("ignores broken or oversized regex instead of throwing", () => {
    expect(matchWordRule("abc", { pattern: "(", matchMode: "REGEX" })).toBe(false);
    expect(matchWordRule("abc", { pattern: "a".repeat(81), matchMode: "REGEX" })).toBe(false);
    expect(matchWordRule("needle", { pattern: "needle", matchMode: "REGEX" })).toBe(true);
  });
});

describe("escalation ladder", () => {
  const ladder = [
    { step: 1, action: "WARN" as const, durationSec: null },
    { step: 2, action: "TIMEOUT" as const, durationSec: 60 },
    { step: 3, action: "KICK" as const, durationSec: null },
  ];
  it("starts at the first step and escalates", () => {
    expect(nextLadderAction(0, ladder).action).toBe("WARN");
    expect(nextLadderAction(1, ladder).action).toBe("TIMEOUT");
    expect(nextLadderAction(2, ladder).action).toBe("KICK");
  });
});
