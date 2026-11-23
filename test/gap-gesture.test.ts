// @vitest-environment happy-dom
// The Gap tool's gesture (src/ui/gap-gesture.ts) on a stand-in page: the drag shows as an arrow,
// landing on a second element leaves a numbered gap mark in page coordinates and asks for its
// note; a drag that starts or ends off the page's elements, or on two that overlap, says why and
// leaves nothing.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Pin } from "../src/marks/types";
import type { Point } from "../src/shared/geometry";
import { gapBadge, gapGesture } from "../src/ui/gap-gesture";
import { initialState } from "../src/ui/state";

type Box = { el: HTMLElement; x: number; y: number; w: number; h: number };

/** Elements laid out at fixed view rects; elementsFromPoint answers from them, topmost last added. */
function page(boxes: Omit<Box, "el">[]): HTMLElement[] {
  const laid: Box[] = boxes.map((b) => {
    const el = document.createElement("div");
    el.getBoundingClientRect = () => ({ left: b.x, top: b.y, width: b.w, height: b.h }) as DOMRect;
    document.body.append(el);
    return { el, ...b };
  });
  Object.defineProperty(document, "elementsFromPoint", {
    configurable: true,
    value: (x: number, y: number) =>
      laid.filter((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h).map((b) => b.el).reverse(),
  });
  return laid.map((b) => b.el);
}

/** The gesture on a host whose drag the test drives: move to points, then let go. */
function gesture() {
  const state = initialState();
  const host = document.createElement("div");
  document.body.append(host);
  const root = host.attachShadow({ mode: "open" });
  const say = vi.fn();
  let move: ((p: Point, shift: boolean) => void) | null = null;
  let end: (() => void) | null = null;
  const drag = (_down: PointerEvent, m: typeof move, e: typeof end) => {
    move = m;
    end = e;
  };
  const { startGap } = gapGesture({ state, root, host, say, drag: drag as never, update: (change) => change() });
  const dragFrom = (from: Point, to: Point) => {
    startGap(new PointerEvent("pointerdown"), from);
    move?.(to, false);
    end?.();
  };
  return { state, root, say, dragFrom, moveTo: (p: Point) => move?.(p, false) };
}

const scrolled = (x: number, y: number) => {
  vi.stubGlobal("scrollX", x);
  vi.stubGlobal("scrollY", y);
};
beforeEach(() => scrolled(0, 0));
afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, "elementsFromPoint");
  document.body.replaceChildren();
});

describe("startGap", () => {
  it("shows the drag as an arrow from where it started to where the pointer is", () => {
    page([{ x: 100, y: 100, w: 80, h: 40 }]);
    const g = gesture();
    const { startGap } = gapGesture({
      state: g.state,
      root: g.root,
      host: document.createElement("div"),
      say: g.say,
      update: (change) => change(),
      drag: (_down, move) => move({ x: 150, y: 130 }, false),
    });
    startGap(new PointerEvent("pointerdown"), { x: 120, y: 110 });
    expect(g.state.draft).toMatchObject({ kind: "arrow", from: { x: 120, y: 110 }, to: { x: 150, y: 130 } });
  });

  it("from one element to another: a gap mark between them, the arrow gone, its note asked", async () => {
    const [a, b] = page([
      { x: 100, y: 100, w: 80, h: 40 },
      { x: 204, y: 110, w: 80, h: 40 },
    ]);
    const g = gesture();
    g.dragFrom({ x: 150, y: 120 }, { x: 230, y: 125 });

    expect(g.state.draft).toBeNull();
    expect(g.say).not.toHaveBeenCalled();
    const pin = g.state.marks[0] as Pin & { kind: "gap" };
    expect(pin).toMatchObject({ kind: "gap", el: a, other: b, note: "", line: { axis: "x", px: 24 } });
    expect(pin.at).toEqual(gapBadge(pin.line));

    const input = g.root.querySelector(".bubble textarea") as HTMLTextAreaElement;
    expect(input.placeholder).toBe("Smaller, bigger, or the gap you want (optional)");
    input.value = "  16px  ";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await vi.waitFor(() => expect(pin.note).toBe("16px"));
  });

  it("on a scrolled page: finds the elements where they are on screen and keeps the mark in page coordinates", () => {
    const [a, b] = page([
      { x: 100, y: 100, w: 80, h: 40 },
      { x: 204, y: 110, w: 80, h: 40 },
    ]);
    scrolled(0, 500);
    const g = gesture();
    g.dragFrom({ x: 150, y: 620 }, { x: 230, y: 625 });
    const pin = g.state.marks[0] as Pin & { kind: "gap" };
    expect(pin).toMatchObject({ el: a, other: b });
    expect(pin.line.from.y).toBe(625);
    expect(pin.line.to.y).toBe(625);
  });

  it("Esc keeps the gap without a note", async () => {
    page([
      { x: 100, y: 100, w: 80, h: 40 },
      { x: 204, y: 110, w: 80, h: 40 },
    ]);
    const g = gesture();
    g.dragFrom({ x: 150, y: 120 }, { x: 230, y: 125 });
    const input = g.root.querySelector(".bubble textarea") as HTMLTextAreaElement;
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await vi.waitFor(() => expect(g.root.querySelector(".bubble")).toBeNull());
    expect(g.state.marks).toHaveLength(1);
    expect((g.state.marks[0] as Pin).note).toBe("");
  });

  it("ending off the page's elements says so and leaves nothing", () => {
    page([{ x: 100, y: 100, w: 80, h: 40 }]);
    const g = gesture();
    g.dragFrom({ x: 150, y: 120 }, { x: 600, y: 600 });
    expect(g.say).toHaveBeenCalledWith("Gap: start and end the drag on elements of the page.", "error");
    expect(g.state.marks).toEqual([]);
    expect(g.state.draft).toBeNull();
    expect(g.root.querySelector(".bubble")).toBeNull();
  });

  it("starting off the page's elements says so too", () => {
    page([{ x: 204, y: 110, w: 80, h: 40 }]);
    const g = gesture();
    g.dragFrom({ x: 10, y: 10 }, { x: 230, y: 125 });
    expect(g.say).toHaveBeenCalledWith("Gap: start and end the drag on elements of the page.", "error");
    expect(g.state.marks).toEqual([]);
  });

  it("two elements that overlap: says why there is no gap and leaves nothing", () => {
    page([
      { x: 100, y: 100, w: 80, h: 40 },
      { x: 150, y: 120, w: 80, h: 40 },
    ]);
    const g = gesture();
    g.dragFrom({ x: 110, y: 110 }, { x: 225, y: 155 });
    expect(g.say).toHaveBeenCalledWith("Gap: these two overlap: there is no space between them.", "error");
    expect(g.state.marks).toEqual([]);
  });

  it("the Pointer layer itself is never an end: the element under it is", () => {
    const [a, b] = page([
      { x: 100, y: 100, w: 80, h: 40 },
      { x: 204, y: 110, w: 80, h: 40 },
    ]);
    const g = gesture();
    const layer = g.root.host as HTMLElement;
    const under = document.elementsFromPoint.bind(document);
    Object.defineProperty(document, "elementsFromPoint", {
      configurable: true,
      value: (x: number, y: number) => [layer, ...under(x, y)],
    });
    g.dragFrom({ x: 150, y: 120 }, { x: 230, y: 125 });
    expect(g.state.marks[0]).toMatchObject({ el: a, other: b });
  });
});
