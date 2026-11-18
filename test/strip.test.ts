import { describe, expect, it } from "vitest";
import { stripHeight, wrapLines } from "../src/capture/strip";

describe("wrapLines (the text strip under the picture)", () => {
  it("keeps short lines as they are", () => {
    expect(wrapLines("[1] pick · Card\n   file: src/a.tsx:3", 40)).toEqual(["[1] pick · Card", "   file: src/a.tsx:3"]);
  });

  it("wraps at a space and indents the rest under its line", () => {
    expect(wrapLines("   note: make the search bar much wider please", 24)).toEqual([
      "   note: make the search",
      "     bar much wider",
      "     please",
    ]);
  });

  it("cuts a long path without spaces at the width", () => {
    const lines = wrapLines("   file: src/feature/dance/shell/desktop/map/ui/EventMap.tsx:197", 30);
    expect(lines.every((l) => l.length <= 30)).toBe(true);
    expect(lines.join("").replace(/\s+/g, "")).toBe("file:src/feature/dance/shell/desktop/map/ui/EventMap.tsx:197");
  });

  it("never stalls on a deep indent in a narrow strip", () => {
    const lines = wrapLines(`${" ".repeat(30)}${"x".repeat(50)}`, 10);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((l) => l.length <= 10)).toBe(true);
    expect(lines.join("").replace(/\s+/g, "")).toBe("x".repeat(50));
  });

  it("sizes the strip: nothing for no lines", () => {
    expect(stripHeight(0)).toBe(0);
    expect(stripHeight(3)).toBe(74);
  });
});
