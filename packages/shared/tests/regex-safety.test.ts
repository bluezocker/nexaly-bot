import { describe, expect, it } from "vitest";
import { isRegexPatternSafe, matchWordRule, moderationRuleSchema } from "../src/index.js";

const base = {
  type: "WORD" as const,
  matchMode: "REGEX" as const,
  action: "DELETE" as const,
  durationSec: null,
  enabled: true,
  exceptRoleIds: [],
  exceptChannelIds: [],
};

describe("isRegexPatternSafe", () => {
  it.each(["needle", "fr[e3]e\\s*nitro", "discord\\.gg/\\w+", "^(hallo|hi)$", "a{2,5}", "(ab)+", "colou?r", "(?:x|y)z", "[a+]+"])(
    "erlaubt harmloses Muster %s",
    (pattern) => expect(isRegexPatternSafe(pattern)).toBe(true),
  );

  it.each(["(a+)+$", "(a*)*", "(a|aa)+", "(\\w+\\s?)*$", "((ab)+)+", "(a|b)*c", "(x+){2,}", ".*a.*b.*c", "(a)\\1", "(?=a)b", "(?<!a)b", "a?".repeat(20) + "a".repeat(20), "(", "a".repeat(81)])(
    "lehnt riskantes/ungültiges Muster %s ab",
    (pattern) => expect(isRegexPatternSafe(pattern)).toBe(false),
  );
});

describe("REGEX-Regeln", () => {
  it("friert bei bekanntem ReDoS-Muster nicht ein", () => {
    const start = Date.now();
    expect(matchWordRule("a".repeat(5000) + "!", { pattern: "(a+)+$", matchMode: "REGEX" })).toBe(false);
    expect(Date.now() - start).toBeLessThan(50);
  });

  it("Schema lehnt riskante Regex beim Speichern ab", () => {
    expect(moderationRuleSchema.safeParse({ ...base, pattern: "(a+)+$" }).success).toBe(false);
    expect(moderationRuleSchema.safeParse({ ...base, pattern: "free\\s*nitro" }).success).toBe(true);
  });

  it("Schema lässt Nicht-Regex-Regeln mit Klammern unverändert zu", () => {
    expect(moderationRuleSchema.safeParse({ ...base, matchMode: "CONTAINS", pattern: "(a+)+" }).success).toBe(true);
  });
});
