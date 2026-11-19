// @vitest-environment happy-dom
// The Gap tool's measure and the Idea tool (Edvard, 2026-11-19): snapping to facing edges, CSS
// pixels at a zoom that is not 100%, the one-line outputs, the keys, an idea's fallback.
import { describe, expect, it } from "vitest";
import { IDEA_ASK, formatStrip } from "../src/bundle/format";
import type { Bundle, ComponentInfo, PinInfo } from "../src/bundle/types";
import { measureGap } from "../src/draw/gap";
import { commandFor } from "../src/ui/keys";
import { pinTarget } from "../src/ui/notes";

const at = (x: number, y: number) => ({ x, y });

describe("measureGap snaps to the facing edges", () => {
  const a = { x: 100, y: 100, w: 80, h: 40 };

  it("side by side: across, from a's right edge to b's left edge, at the middle of their overlap", () => {
    const b = { x: 204, y: 110, w: 80, h: 40 };
    expect(measureGap(a, b, at(150, 120), at(230, 125))).toEqual({
      kind: "line",
      line: { axis: "x", from: { x: 180, y: 125 }, to: { x: 204, y: 125 }, px: 24 },
    });
  });

  it("stacked: down, whichever way the drag goes", () => {
    const b = { x: 100, y: 152, w: 80, h: 40 };
    const answer = measureGap(b, a, at(140, 170), at(140, 110));
    expect(answer).toMatchObject({ kind: "line", line: { axis: "y", from: { y: 140 }, to: { y: 152 }, px: 12 } });
  });

  it("a child to its container: the inner space on the side the drag points to", () => {
    const card = { x: 0, y: 0, w: 300, h: 200 };
    const title = { x: 16, y: 24, w: 200, h: 30 };
    expect(measureGap(title, card, at(50, 40), at(4, 40))).toMatchObject({ line: { axis: "x", px: 16 } });
    expect(measureGap(title, card, at(50, 30), at(50, 2))).toMatchObject({ line: { axis: "y", px: 24 } });
  });

  it("overlapping elements have no gap, and say so", () => {
    const b = { x: 150, y: 120, w: 80, h: 40 };
    expect(measureGap(a, b, at(110, 110), at(200, 150))).toEqual({
      kind: "none",
      why: "these two overlap: there is no space between them",
    });
  });

  it("in CSS pixels at 125% zoom: the fractional rects Chrome gives still read 24px", () => {
    // At 125% a CSS pixel is 1.25 device pixels; getBoundingClientRect stays in CSS pixels but
    // lands on device-pixel steps of 0.8.
    const left = { x: 100.8, y: 50.4, w: 79.2, h: 40 };
    const right = { x: 204, y: 50.4, w: 80, h: 40 };
    expect(measureGap(left, right, at(150, 60), at(230, 60))).toMatchObject({ line: { px: 24 } });
  });
});

const comp = (name: string, file: string, line: number): ComponentInfo => ({
  framework: "react",
  chain: [name],
  where: { kind: "found", source: { file, line } },
});
const el = (selector: string) => ({ selector, tag: "button", size: { w: 80, h: 32 } });
const bundle = (pins: PinInfo[]): Bundle => ({
  url: "http://localhost:3300/",
  viewport: { w: 1440, h: 900 },
  crops: [],
  pins,
  drawings: { arrows: 0, boxes: 0, ellipses: 0, pens: 0, texts: [], pasted: 0 },
  image: null,
});

describe("the one-line outputs", () => {
  it("a gap: the pixels, both elements' file:line, the note", () => {
    const gap: PinInfo = {
      n: 3,
      kind: "gap",
      component: comp("ButtonA", "src/Header.tsx", 41),
      el: el("button.a"),
      changes: [],
      note: "smaller, ~12px",
      px: 24,
      axis: "x",
      other: { component: comp("ButtonB", "src/Header.tsx", 52), el: el("button.b") },
    };
    expect(formatStrip(bundle([gap]), false).split("\n").at(-1)).toBe(
      "[3] gap: 24px between ButtonA (src/Header.tsx:41) and ButtonB (src/Header.tsx:52); note: smaller, ~12px",
    );
  });

  it("an idea: the same ask every time, the thought when there is one, and the task says it is a question", () => {
    const idea = (note: string): PinInfo => ({ n: 4, kind: "idea", component: comp("EventCard", "src/EventCard.tsx", 27), el: el("div.card"), changes: [], note });
    const text = formatStrip(bundle([idea("too busy?")]), false).split("\n");
    expect(text.at(-1)).toBe(`[4] idea? EventCard (src/EventCard.tsx:27) · your thought: "too busy?" ${IDEA_ASK}`);
    expect(text[1]).toContain("An idea? [n] is a question, not a change");
    expect(formatStrip(bundle([idea("")]), false).split("\n").at(-1)).toBe(`[4] idea? EventCard (src/EventCard.tsx:27) ${IDEA_ASK}`);
    expect(IDEA_ASK).toBe(
      "→ as a UI/UX expert and design critic: what's wrong here and why, then 2–3 fixes, your recommendation first; ask before building",
    );
  });
});

describe("their keys and an idea's element", () => {
  const key = (k: string) => ({ key: k, ctrlKey: false, metaKey: false, altKey: false });

  it("Q is Idea, G is Gap", () => {
    expect(commandFor(key("q"), "comment")).toEqual({ type: "tool", tool: "idea" });
    expect(commandFor(key("g"), "comment")).toEqual({ type: "tool", tool: "gap" });
  });

  it("an idea snaps to the element under it, and falls back to the page", () => {
    document.body.innerHTML = `<button>Join</button>`;
    const button = document.querySelector("button");
    expect(pinTarget("idea", button)).toBe(button);
    expect(pinTarget("idea", null)).toBe(document.body);
    expect(pinTarget("comment", null)).toBeNull();
  });
});
