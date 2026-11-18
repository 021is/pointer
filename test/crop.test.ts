import { describe, expect, it } from "vitest";
import { formatBundle, formatCrop } from "../src/bundle/format";
import { GAP, TAB, stackRegions } from "../src/capture/layout";
import { STRIP } from "../src/capture/strip";
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
      false,
    );
    expect(stack.placed.map((p) => p.top)).toEqual([TAB, TAB + 100 + GAP + TAB]);
    expect(stack.bottom).toBe(TAB + 100 + GAP + TAB + 50);
    expect(stack.width).toBe(500);
  });

  it("the auto crop has no tab, and a strip makes the picture at least its minimum width", () => {
    const stack = stackRegions([{ label: null, rect: { x: 0, y: 0, w: 300, h: 100 } }], true);
    expect(stack.placed[0]?.top).toBe(0);
    expect(stack.width).toBe(STRIP.minWidth);
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
      }),
    ).toBe("crop A · ProfileHeader ← ProfilePage · src/feature/profile/Header.tsx:42 · 320×180");
    expect(formatCrop({ label: "B", component: null, size: { w: 400, h: 300 } })).toBe("crop B · frame 400×300");
  });

  it("come right after the head line", () => {
    const text = formatBundle({
      url: "https://x.dev/",
      viewport: { w: 1280, h: 800 },
      crops: [{ label: "A", component: null, size: { w: 10, h: 10 } }],
      pins: [],
      drawings: { arrows: 1, boxes: 0, ellipses: 0, pens: 0, texts: [] },
      image: null,
    });
    expect(text.split("\n")).toEqual(["Pointer · https://x.dev/ · viewport 1280×800", "crop A · frame 10×10", "drawn: 1 arrow"]);
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
