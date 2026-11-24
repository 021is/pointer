// Crops scrolled out of view are captured anyway (Edvard, 2026-11-24): the plan of where Pointer
// scrolls for each screenshot. Crops in view are taken where the page is; close ones share a stop,
// far ones get one each, centred; a crop larger than the screen shows its top left; a crop in a
// scrolling box of its own is scrolled there by its box. The note never says "failed".
import { describe, expect, it } from "vitest";
import { type PageFrame, type Screen, framedSizes, planSweep, sweepNote } from "../src/capture/sweep";

const screen: Screen = { size: { w: 400, h: 800 }, scroll: { x: 0, y: 0 }, max: { x: 0, y: 5000 } };
const frame = (label: string, y: number, h = 100, more: Partial<PageFrame> = {}): PageFrame => ({
  label,
  rect: { x: 20, y, w: 300, h },
  nested: false,
  clipped: false,
  ...more,
});

describe("planSweep", () => {
  it("takes the page as it is when every crop is in view: one stop, no scroll", () => {
    expect(planSweep([frame("A", 100), frame("B", 500)], screen)).toEqual({
      stops: [{ kind: "page", scroll: { x: 0, y: 0 }, labels: ["A", "B"] }],
      larger: [],
    });
  });

  it("scrolls to crops out of view, centred on them, after the ones in view", () => {
    const plan = planSweep([frame("A", 100), frame("B", 2000)], screen);
    expect(plan.stops).toEqual([
      { kind: "page", scroll: { x: 0, y: 0 }, labels: ["A"] },
      { kind: "page", scroll: { x: 0, y: 1650 }, labels: ["B"] },
    ]);
  });

  it("puts crops close together in one stop and crops far apart in one each", () => {
    const plan = planSweep([frame("A", 3000), frame("B", 1200), frame("C", 1500), frame("D", 900, 100, {})], { ...screen, scroll: { x: 0, y: 4000 } });
    expect(plan.stops.map((s) => (s.kind === "page" ? s.labels : [s.label]))).toEqual([["D", "B", "C"], ["A"]]);
  });

  it("a crop half in view is taken whole from a stop of its own", () => {
    const plan = planSweep([frame("A", 750)], screen);
    expect(plan.stops).toEqual([{ kind: "page", scroll: { x: 0, y: 400 }, labels: ["A"] }]);
  });

  it("never scrolls past the page's ends", () => {
    expect(planSweep([frame("A", 5600, 50)], screen).stops[0]).toEqual({ kind: "page", scroll: { x: 0, y: 5000 }, labels: ["A"] });
    expect(planSweep([frame("A", 10)], { ...screen, scroll: { x: 0, y: 2000 } }).stops[0]).toEqual({
      kind: "page",
      scroll: { x: 0, y: 0 },
      labels: ["A"],
    });
  });

  it("a crop larger than the screen: its own stop at its top left, and named as larger", () => {
    const plan = planSweep([frame("A", 1000, 2000)], screen);
    expect(plan).toEqual({ stops: [{ kind: "page", scroll: { x: 0, y: 1000 }, labels: ["A"] }], larger: ["A"] });
  });

  it("a crop in a scrolling box of its own is scrolled there by its box, even when its box hides it in view", () => {
    const plan = planSweep([frame("A", 100, 100, { nested: true, clipped: true }), frame("B", 200, 100, { nested: true })], screen);
    expect(plan.stops).toEqual([
      { kind: "page", scroll: { x: 0, y: 0 }, labels: ["B"] },
      { kind: "box", label: "A", whole: true },
    ]);
  });
});

describe("sweepNote", () => {
  it("is nothing when every crop is in whole", () => {
    expect(sweepNote([], [])).toBeNull();
  });

  it("says plainly what to do, never that something failed", () => {
    const one = sweepNote(["B"], []) ?? "";
    expect(one).toBe(
      "Crop B is larger than the screen, so the picture shows the top left part. To get all of it, crop a smaller part or zoom the page out (Ctrl − or ⌘ −) and copy again.",
    );
    const all = sweepNote(["A", "C"], ["D"]) ?? "";
    expect(all).toContain("Crops A, C are larger than the screen");
    expect(all).toContain("Crop D was not found on the page when copying, so the text names it without a picture.");
    expect(`${one} ${all}`).not.toMatch(/fail/i);
  });
});

describe("framedSizes", () => {
  it("counts every crop for the cost, at most the screen's size", () => {
    expect(framedSizes([{ label: "A", rect: { x: 5, y: -900, w: 300, h: 2000 } }], { w: 400, h: 800 })).toEqual([
      { label: "A", rect: { x: 0, y: 0, w: 300, h: 800 } },
    ]);
  });
});
