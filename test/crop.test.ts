import { describe, expect, it } from "vitest";
import { formatBundle, formatCrop } from "../src/bundle/format";
import { cropInfos, shownIn } from "../src/capture/copy";
import { BUDGET, GAP, stackRegions } from "../src/capture/layout";
import { STRIP, stripHeight } from "../src/capture/strip";
import { FRAME_TAB as TAB } from "../src/marks/svg";
import { type Crop, cropLabel } from "../src/marks/types";
import { commandFor } from "../src/ui/keys";
import { type Layout, initialState, liveScene, sceneFrames, shapesOf, wantsImage } from "../src/ui/state";

const layout: Layout = { scroll: { x: 0, y: 100 }, rectOf: () => ({ x: 10, y: 20, w: 300, h: 200 }) };
const free: Crop = { kind: "crop", el: null, rect: { x: 50, y: 150, w: 400, h: 300 } };
const component: Crop = { kind: "crop", el: { isConnected: true } as Element, rect: { x: 0, y: 0, w: 1, h: 1 } };

describe("crop labels", () => {
  it("are letters, never numbers (those are the pins')", () => {
    expect([0, 1, 25, 26, 27].map(cropLabel)).toEqual(["A", "B", "Z", "AA", "AB"]);
  });
});

describe("sceneFrames", () => {
  it("follows a component live (4px of air) and scrolls a free frame with the page", () => {
    expect(sceneFrames([component, free], layout)).toEqual([
      { label: "A", rect: { x: 6, y: 16, w: 308, h: 208 } },
      { label: "B", rect: { x: 50, y: 50, w: 400, h: 300 } },
    ]);
  });

  it("dims outside the frames when not picking, and frames are not drawings", () => {
    const state = { ...initialState(), tool: "pen" as const, marks: [free] };
    expect(liveScene(state, layout).dim?.holes).toEqual([{ x: 50, y: 50, w: 400, h: 300 }]);
    expect(shapesOf(state.marks)).toEqual([]);
    expect(wantsImage({ ...state, marks: [free] })).toBe(true);
  });
});

describe("stackRegions: several frames in one picture", () => {
  it("stacks frames with a letter tab above each and a gap between", () => {
    const stack = stackRegions(
      [
        { label: "A", rect: { x: 0, y: 0, w: 300, h: 100 } },
        { label: "B", rect: { x: 0, y: 0, w: 500, h: 50 } },
      ],
      null,
    );
    expect(stack.placed.map((p) => p.top)).toEqual([TAB, TAB + 100 + GAP + TAB]);
    expect(stack.bottom).toBe(TAB + 100 + GAP + TAB + 50);
    expect(stack.width).toBe(500);
  });

  it("the auto crop has no tab, and a strip makes the picture at least its minimum width", () => {
    const stack = stackRegions([{ label: null, rect: { x: 0, y: 0, w: 300, h: 100 } }], () => 3);
    expect(stack.placed[0]?.top).toBe(0);
    expect(stack.width).toBe(STRIP.minWidth);
    expect(stack.height).toBe(100 + stripHeight(3));
  });

  it("shrinks the frames, never the text, until Claude reads it at full size", () => {
    // Edvard's paste: three tall frames + a long strip came out 720×3572, which Claude scales down.
    const tall = (label: string, h: number) => ({ label, rect: { x: 0, y: 0, w: 428, h } });
    const stack = stackRegions([tall("A", 772), tall("B", 40), tall("C", 712)], () => 30);
    expect(stack.height - stack.bottom).toBe(stripHeight(30));
    expect(stack.height).toBeLessThanOrEqual(BUDGET.edge);
    expect(stack.width * stack.height).toBeLessThanOrEqual(BUDGET.area);
    expect(stack.placed[0]?.size.h).toBeLessThan(772);
  });

  it("leaves a picture that already fits at full size", () => {
    const stack = stackRegions([{ label: null, rect: { x: 0, y: 0, w: 600, h: 400 } }], () => 10);
    expect(stack.placed[0]?.size).toEqual({ w: 600, h: 400 });
  });
});

describe("cropInfos", () => {
  it("names each crop's component and how it shows in the picture", async () => {
    const info = { framework: "react" as const, chain: ["Card"], where: { kind: "silent" as const } };
    const frames = sceneFrames([component, free], layout);
    const infos = await cropInfos([component, free], frames, (l) => (l === "B" ? "part" : "whole"), async () => info);
    expect(infos).toEqual([
      { label: "A", component: info, size: { w: 308, h: 208 }, shown: "whole" },
      { label: "B", component: null, size: { w: 400, h: 300 }, shown: "part" },
    ]);
  });

  it("takes how each crop shows from the shots: whole, larger than the screen, or not found", () => {
    const shown = shownIn({ cuts: [], larger: ["B"], missed: ["C"] });
    expect(["A", "B", "C"].map(shown)).toEqual(["whole", "part", "none"]);
    expect(shownIn(null)("A")).toBe("whole");
  });
});

describe("crops in the bundle", () => {
  it("names a component crop with its file, a free frame with its size", () => {
    expect(
      formatCrop({
        label: "A",
        component: {
          framework: "react",
          chain: ["ProfileHeader", "ProfilePage"],
          where: { kind: "found", source: { file: "src/feature/profile/Header.tsx", line: 42 } },
        },
        size: { w: 320, h: 180 },
        shown: "whole",
      }),
    ).toBe("crop A · ProfileHeader ← ProfilePage · src/feature/profile/Header.tsx:42 · 320×180");
    expect(formatCrop({ label: "B", component: null, size: { w: 400, h: 300 }, shown: "whole" })).toBe("crop B · frame 400×300");
    expect(formatCrop({ label: "C", component: null, size: { w: 900, h: 2000 }, shown: "part" })).toBe(
      "crop C · frame 900×2000 (larger than the screen: the picture shows its top left part)",
    );
    expect(formatCrop({ label: "D", component: null, size: { w: 9, h: 9 }, shown: "none" })).toBe(
      "crop D · frame 9×9 (not on the page at Copy, not in the picture)",
    );
  });

  it("come right after the head line", () => {
    const text = formatBundle({
      url: "https://x.dev/",
      viewport: { w: 1280, h: 800 },
      crops: [{ label: "A", component: null, size: { w: 10, h: 10 }, shown: "whole" }],
      pins: [],
      shapeNotes: [],
      drawings: { arrows: 1, boxes: 0, ellipses: 0, pens: 0, texts: [], pasted: 0 },
      image: null,
    });
    const lines = text.split("\n");
    expect(lines[1]).toMatch(/^Task: /);
    expect(lines.slice(2)).toEqual(["crop A · frame 10×10", "drawn: 1 arrow"]);
  });

  it("a crop-only bundle asks to read the crops and their drawings, not quoted text or [n]", () => {
    const base = {
      url: "https://x.dev/",
      viewport: { w: 1280, h: 800 },
      pins: [],
      shapeNotes: [],
      drawings: { arrows: 1, boxes: 0, ellipses: 0, pens: 0, texts: [], pasted: 0 },
      image: null,
    };
    const frame = formatBundle({ ...base, crops: [{ label: "A", component: null, size: { w: 10, h: 10 }, shown: "whole" }] });
    const task = frame.split("\n")[1] ?? "";
    expect(task).toContain("framed these parts of the page");
    expect(task).not.toMatch(/quoted text|\[n\]/);
    const component = {
      framework: "react" as const,
      chain: ["Card"],
      where: { kind: "found" as const, source: { file: "src/Card.tsx", line: 3 } },
    };
    const withFile = formatBundle({ ...base, crops: [{ label: "A", component, size: { w: 10, h: 10 }, shown: "whole" }] });
    expect(withFile.split("\n")[1]).toContain("a crop's file:line, when given, is where it is written");
  });
});

describe("keys for the crop tool", () => {
  const key = (k: string) => ({ key: k, ctrlKey: false, metaKey: false, altKey: false });
  it("X picks it; arrows walk and Enter takes the component, like pick", () => {
    expect(commandFor(key("x"), "pen")).toEqual({ type: "tool", tool: "crop" });
    expect(commandFor(key("ArrowUp"), "crop")).toEqual({ type: "walk", key: "ArrowUp" });
    expect(commandFor(key("Enter"), "crop")).toEqual({ type: "pick-hover" });
  });
});
