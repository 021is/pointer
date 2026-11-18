import { describe, expect, it } from "vitest";
import { costsOf, pictureSize, textTokens } from "../src/capture/estimate";
import { isPreviewRequest } from "../src/shared/messages";
import { copiedLabel } from "../src/ui/copy-flow";
import { markAt, shifted, toSegment } from "../src/ui/move";
import { OUTPUTS, initialState, otherOutput, wantsImage } from "../src/ui/state";
import type { Mark } from "../src/marks/types";

describe("what each output costs, before copying", () => {
  const regions = [{ label: null, rect: { x: 0, y: 0, w: 600, h: 400 } }];

  it("prices pictures like Claude (w×h/750) and text at ~3.3 characters a token", () => {
    expect(textTokens("x".repeat(33))).toBe(10);
    const costs = costsOf(regions, "Pointer · line one\n[1] pick · Card", "short text");
    expect(costs.image).toBe(Math.ceil((600 * 400) / 750));
    expect(costs.picture).toBeGreaterThan(costs.image);
    expect(costs.text).toBe(textTokens("short text"));
  });

  it("a picture's strip makes it taller, never narrower than the strip's width", () => {
    const withStrip = pictureSize(regions, "a\nb\nc");
    const without = pictureSize(regions, null);
    expect(withStrip.h).toBeGreaterThan(without.h);
    expect(without).toEqual({ w: 600, h: 400 });
  });

  it("no regions (every crop scrolled away) costs no picture", () => {
    expect(costsOf(null, "a", "b")).toMatchObject({ picture: 0, image: 0 });
  });
});

describe("Copy's choices", () => {
  it("are three, in the menu's order; Text only is the one without a picture", () => {
    expect(OUTPUTS.map((o) => o.output)).toEqual(["picture", "text", "image"]);
    expect(wantsImage({ ...initialState(), output: "image" })).toBe(true);
    expect(wantsImage({ ...initialState(), output: "text" })).toBe(false);
    expect(otherOutput("image")).toBe("text");
  });

  it("start with Comment, Picture + text, and no clearing", () => {
    expect(initialState()).toMatchObject({ tool: "comment", output: "picture", clearAfterCopy: false });
  });

  it("confirm on the button with marks and tokens", () => {
    expect(copiedLabel(1, 92)).toBe("Copied · 1 mark · ≈92 tok");
    expect(copiedLabel(3, 140)).toBe("Copied · 3 marks · ≈140 tok");
  });
});

describe("a preview is checked where it enters the service worker", () => {
  const good = { type: "preview", png: "data:image/png;base64,AAAA", text: "x", tokens: 3, output: "picture" };
  it("accepts a well-formed one, refuses anything else", () => {
    expect(isPreviewRequest(good)).toBe(true);
    expect(isPreviewRequest({ ...good, png: "https://evil.example/x.png" })).toBe(false);
    expect(isPreviewRequest({ ...good, tokens: "3" })).toBe(false);
    expect(isPreviewRequest({ ...good, png: null, text: null })).toBe(true);
  });
});

describe("the Move tool grabs the topmost mark under the pointer", () => {
  const marks: Mark[] = [
    { kind: "box", color: "red", rect: { x: 0, y: 0, w: 100, h: 100 } },
    { kind: "arrow", color: "blue", from: { x: 0, y: 200 }, to: { x: 200, y: 200 } },
    { kind: "crop", el: null, rect: { x: 300, y: 0, w: 100, h: 100 } },
    { kind: "crop", el: {} as Element, rect: { x: 500, y: 0, w: 100, h: 100 } },
  ];

  it("finds a box, an arrow near its line, a free crop; never a component's crop", () => {
    expect(markAt(marks, { x: 50, y: 50 })?.kind).toBe("box");
    expect(markAt(marks, { x: 100, y: 205 })?.kind).toBe("arrow");
    expect(markAt(marks, { x: 100, y: 230 })).toBeUndefined();
    expect(markAt(marks, { x: 350, y: 50 })?.kind).toBe("crop");
    expect(markAt(marks, { x: 550, y: 50 })).toBeUndefined();
  });

  it("shifts what it grabs, from where it started", () => {
    const box = marks[0];
    if (box?.kind !== "box") throw new Error("fixture");
    expect(shifted(box, 10, -5)).toMatchObject({ rect: { x: 10, y: -5, w: 100, h: 100 } });
    expect(toSegment({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(5);
  });
});
