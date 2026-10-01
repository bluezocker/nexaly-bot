import { describe, expect, it } from "vitest";
import { parseHex, solidPng } from "./png.js";

describe("welcome fallback png", () => {
  it("parses hex colors", () => {
    expect(parseHex("#7C5CFF")).toEqual([124, 92, 255]);
  });

  it("emits a PNG signature", () => {
    const png = solidPng(8, 8, [124, 92, 255]);
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(png.length).toBeGreaterThan(32);
  });
});
