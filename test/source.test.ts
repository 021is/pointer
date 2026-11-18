import { describe, expect, it } from "vitest";
import { type RawMap, decodeDataUrl, decodeVlq, mapUrlOf, originalPosition } from "../src/source/sourcemap";
import { appFrames, cleanSourcePath, isDependency, parseStack } from "../src/source/stack";

describe("decodeVlq", () => {
  it("reads single and multi-digit values, signs included", () => {
    expect(decodeVlq("AAAA")).toEqual([0, 0, 0, 0]);
    expect(decodeVlq("CADA")).toEqual([1, 0, -1, 0]);
    expect(decodeVlq("gB")).toEqual([16]);
    expect(decodeVlq("2H")).toEqual([123]);
  });

  it("refuses a character that is not base64", () => {
    expect(() => decodeVlq("A!")).toThrow(/bad VLQ/);
  });
});

// Generated line 0 → a.tsx 1:1; line 1 col 0 → a.tsx 2:1, col 4 → a.tsx 2:5; line 2 → b.tsx 2:5.
const plain: RawMap = { version: 3, sources: ["a.tsx", "b.tsx"], mappings: "AAAA;AACA,IAAI;ACAA" };

describe("originalPosition", () => {
  it("finds the segment at or before the column", () => {
    expect(originalPosition(plain, 1, 5)).toEqual({ source: "a.tsx", line: 2, column: 5 });
    expect(originalPosition(plain, 1, 2)).toEqual({ source: "a.tsx", line: 2, column: 1 });
  });

  it("carries source and line state across lines", () => {
    expect(originalPosition(plain, 2, 0)).toEqual({ source: "b.tsx", line: 2, column: 5 });
  });

  it("is null past the map", () => {
    expect(originalPosition(plain, 9, 0)).toBeNull();
  });

  it("reads index maps by section (Turbopack)", () => {
    const indexed: RawMap = {
      version: 3,
      sections: [
        { offset: { line: 0, column: 0 }, map: { version: 3, sources: ["x.ts"], mappings: "AAAA" } },
        { offset: { line: 10, column: 0 }, map: { version: 3, sources: ["[project]/src/y.tsx"], mappings: "AAAA;AACA" } },
      ],
    };
    expect(originalPosition(indexed, 11, 3)).toEqual({ source: "[project]/src/y.tsx", line: 2, column: 1 });
    expect(originalPosition(indexed, 0, 0)).toEqual({ source: "x.ts", line: 1, column: 1 });
  });

  it("adds the sourceRoot", () => {
    expect(originalPosition({ ...plain, sourceRoot: "src/" }, 0, 0)?.source).toBe("src/a.tsx");
  });
});

describe("finding the map", () => {
  it("resolves the last sourceMappingURL against the chunk", () => {
    const code = "x()\n//# sourceMappingURL=old.map\ny()\n//# sourceMappingURL=chunk.js.map";
    expect(mapUrlOf(code, "http://localhost:3000/_next/static/chunks/chunk.js")).toBe(
      "http://localhost:3000/_next/static/chunks/chunk.js.map",
    );
    expect(mapUrlOf("no map", "http://x/a.js")).toBeNull();
  });

  it("decodes inline maps (Vite)", () => {
    const json = '{"version":3}';
    expect(decodeDataUrl(`data:application/json;base64,${btoa(json)}`)).toBe(json);
  });
});

const REACT_19_STACK = `Error: react-stack-top-frame
    at exports.jsxDEV (http://localhost:3000/_next/static/chunks/node_modules_react_cjs_react-jsx-dev-runtime_development_1a2b.js:345:12)
    at ProfileCard (http://localhost:3000/_next/static/chunks/src_feature_profile_ProfileCard_tsx_1f2e._.js:40:225)
    at EventList (http://localhost:3000/_next/static/chunks/src_feature_events_9a8b._.js:12:7)
    at Object.react-stack-bottom-frame (http://localhost:3000/_next/static/chunks/node_modules_react-dom_cjs_7c6d.js:1:1)`;

describe("React 19 stacks", () => {
  it("parses Chrome frames", () => {
    const frames = parseStack(REACT_19_STACK);
    expect(frames).toHaveLength(4);
    expect(frames[1]).toEqual({
      fn: "ProfileCard",
      url: "http://localhost:3000/_next/static/chunks/src_feature_profile_ProfileCard_tsx_1f2e._.js",
      line: 40,
      column: 225,
    });
  });

  it("keeps only the app's frames, innermost first", () => {
    expect(appFrames(parseStack(REACT_19_STACK)).map((f) => f.fn)).toEqual(["ProfileCard", "EventList"]);
  });

  it("parses anonymous frames", () => {
    expect(parseStack("    at http://x/a.js:1:2")).toEqual([{ fn: "", url: "http://x/a.js", line: 1, column: 2 }]);
  });
});

describe("cleanSourcePath", () => {
  it.each([
    ["turbopack:///[project]/src/feature/a.tsx", "src/feature/a.tsx"],
    ["[project]/src/feature/a.tsx", "src/feature/a.tsx"],
    ["webpack://_N_E/./src/a.tsx?abc", "src/a.tsx"],
    ["webpack-internal:///(app-pages-browser)/./src/a.tsx", "src/a.tsx"],
    ["http://localhost:5173/src/App.vue?t=123", "src/App.vue"],
    ["file:///home/me/web/src/page.tsx", "src/page.tsx"],
    ["/home/me/projects/web/.wt/live/src/feature/a/src/b.tsx", "src/feature/a/src/b.tsx"],
    ["/home/me/repos/web/app/page.tsx", "web/app/page.tsx"],
  ])("%s → %s", (input, out) => {
    expect(cleanSourcePath(input)).toBe(out);
  });

  it("knows a dependency from the app", () => {
    expect(isDependency("node_modules/next/dist/client/link.js")).toBe(true);
    expect(isDependency("src/feature/a.tsx")).toBe(false);
  });
});
