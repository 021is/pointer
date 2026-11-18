// What crosses a boundary: the URL that leaves for a chat, the server's source map coming in.
import { describe, expect, it } from "vitest";
import { safeUrl } from "../src/bundle/format";
import { byteHex } from "../src/bundle/color";
import { readMap } from "../src/source/sourcemap";
import { appFrames, isDependency } from "../src/source/stack";

describe("safeUrl", () => {
  it("drops the query and the hash, which can carry tokens", () => {
    expect(safeUrl("https://app.example.com/events/42?token=abc&x=1#access_token=zz")).toBe(
      "https://app.example.com/events/42",
    );
    expect(safeUrl("http://localhost:3300/")).toBe("http://localhost:3300/");
  });
});

describe("byteHex", () => {
  it("is always two digits, clamped", () => {
    expect(byteHex(300)).toBe("ff");
    expect(byteHex(-4)).toBe("00");
    expect(byteHex(127.5)).toBe("80");
  });
});

describe("readMap: a source map is checked where it enters", () => {
  it("accepts a plain map and an index map", () => {
    expect(readMap({ version: 3, sources: ["a.ts", null], mappings: "AAAA" })).toEqual({
      version: 3,
      sources: ["a.ts", ""],
      mappings: "AAAA",
      sourceRoot: undefined,
    });
    const indexed = readMap({
      version: 3,
      sections: [{ offset: { line: 0, column: 0 }, map: { version: 3, sources: [], mappings: "" } }],
    });
    expect(typeof indexed).toBe("object");
  });

  it.each([
    [null, "not an object"],
    [{ version: 2 }, "version 2, not 3"],
    [{ version: 3, sources: "a.ts", mappings: "" }, "sources is not a list of strings"],
    [{ version: 3, sources: [], mappings: 7 }, "mappings is not a string"],
    [{ version: 3, sections: [{ offset: {}, map: {} }] }, "section 0 has no numeric offset"],
    [
      { version: 3, sections: [{ offset: { line: 0, column: 0 }, map: { version: 3, sources: [] } }] },
      "section 0: mappings is not a string",
    ],
  ])("says why %j is not a map", (input, why) => {
    expect(readMap(input)).toBe(why);
  });
});

describe("one rule for what is a dependency", () => {
  it("holds for chunk URLs and source paths alike", () => {
    expect(isDependency("http://x/_next/static/chunks/node_modules_react-dom_cjs_1.js")).toBe(true);
    expect(isDependency("node_modules/next/dist/client/link.js")).toBe(true);
    expect(isDependency("react-dom/cjs/react-dom.development.js")).toBe(true);
    expect(isDependency("src/feature/site/home/ui/HomePage.tsx")).toBe(false);
    expect(isDependency("http://x/_next/static/chunks/src_feature_home_1f._.js")).toBe(false);
  });

  it("is what appFrames drops", () => {
    const frame = (url: string) => ({ fn: "X", url, line: 1, column: 1 });
    expect(appFrames([frame("http://x/node_modules/a.js"), frame("http://x/app.js")]).map((f) => f.url)).toEqual([
      "http://x/app.js",
    ]);
  });
});
