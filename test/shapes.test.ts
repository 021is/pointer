import { describe, expect, it } from "vitest";
import { extendShape, isMeaningful, startShape } from "../src/draw/shapes";
import { arrowHead, escapeXml, renderSvg } from "../src/marks/svg";
import type { Pasted } from "../src/marks/types";
import { initialState, moveShape, otherOutput, shapeBox, summarize, wantsImage } from "../src/ui/state";

describe("the bar's Picture | Text switch decides what Copy gives", () => {
  const box = { kind: "box" as const, color: "red" as const, rect: { x: 0, y: 0, w: 9, h: 9 } };

  it("starts on Picture; Text gives text only, even with drawings on the page", () => {
    expect(initialState().output).toBe("picture");
    expect(wantsImage(initialState())).toBe(true);
    expect(wantsImage({ ...initialState(), marks: [box], output: "text" })).toBe(false);
  });

  it("I flips it", () => {
    expect(otherOutput("picture")).toBe("text");
    expect(otherOutput("text")).toBe("picture");
  });

  it("counts pasted images apart from drawings", () => {
    const pasted: Pasted = { kind: "image", img: {} as HTMLImageElement, rect: box.rect, opacity: 1 };
    expect(summarize([box, pasted])).toMatchObject({ boxes: 1, pasted: 1 });
  });
});

const start = { x: 10, y: 10 };

describe("drawing with Shift", () => {
  it("a Shift pen stroke is one straight snapped segment", () => {
    const s = extendShape(startShape("pen", "red", start), start, { x: 90, y: 14 }, true);
    expect(s).toEqual({ kind: "pen", color: "red", points: [start, { x: 90, y: 10 }] });
  });

  it("a free pen stroke skips points closer than 2px", () => {
    let s = startShape("pen", "red", start);
    s = extendShape(s, start, { x: 11, y: 10 }, false);
    s = extendShape(s, start, { x: 15, y: 10 }, false);
    expect(s.kind === "pen" && s.points).toEqual([start, { x: 15, y: 10 }]);
  });

  it("a Shift arrow snaps to 45°", () => {
    const s = extendShape(startShape("arrow", "blue", start), start, { x: 50, y: 48 }, true);
    expect(s).toMatchObject({ kind: "arrow", to: { x: 49, y: 49 } });
  });

  it("a Shift ellipse is a circle", () => {
    const s = extendShape(startShape("ellipse", "red", start), start, { x: 40, y: 20 }, true);
    expect(s).toMatchObject({ rect: { x: 10, y: 10, w: 30, h: 30 } });
  });

  it("a click without a drag leaves nothing", () => {
    expect(isMeaningful(startShape("box", "red", start))).toBe(false);
    expect(isMeaningful(startShape("arrow", "red", start))).toBe(false);
    expect(isMeaningful(startShape("pen", "red", start))).toBe(false);
  });
});

describe("shapes in page and viewport coordinates", () => {
  it("moves every kind by the scroll", () => {
    expect(moveShape({ kind: "text", color: "red", at: { x: 5, y: 500 }, text: "hi" }, 0, -400)).toMatchObject({
      at: { x: 5, y: 100 },
    });
    expect(moveShape({ kind: "box", color: "red", rect: { x: 0, y: 0, w: 5, h: 5 } }, 3, 4)).toMatchObject({
      rect: { x: 3, y: 4, w: 5, h: 5 },
    });
  });

  it("boxes an arrow with room for its head", () => {
    expect(shapeBox({ kind: "arrow", color: "red", from: { x: 10, y: 10 }, to: { x: 50, y: 10 } })).toEqual({
      x: 0,
      y: 0,
      w: 60,
      h: 20,
    });
  });

  it("summarizes what was drawn", () => {
    expect(
      summarize([
        { kind: "box", color: "red", rect: { x: 0, y: 0, w: 5, h: 5 } },
        { kind: "box", color: "red", rect: { x: 0, y: 0, w: 5, h: 5 } },
        { kind: "text", color: "red", at: start, text: "bigger" },
      ]),
    ).toEqual({ arrows: 0, boxes: 2, ellipses: 0, pens: 0, texts: ["bigger"], pasted: 0 });
  });
});

describe("the SVG renderer", () => {
  it("escapes text, so a note can never break the markup", () => {
    expect(escapeXml(`<b>"a" & b</b>`)).toBe("&lt;b&gt;&quot;a&quot; &amp; b&lt;/b&gt;");
  });

  it("points the arrow head back along the shaft", () => {
    const [a, b] = arrowHead({ x: 0, y: 0 }, { x: 100, y: 0 }, 10);
    expect(a.x).toBeCloseTo(91.17, 1);
    expect(a.y).toBeCloseTo(4.69, 1);
    expect(b.y).toBeCloseTo(-4.69, 1);
  });

  it("renders a view-boxed document with a numbered pin", () => {
    const svg = renderSvg(
      { shapes: [], pins: [{ n: 2, color: "yellow", badge: { x: 30, y: 40 }, look: "pin" }] },
      { x: 10, y: 20, w: 300, h: 200 },
    );
    expect(svg).toContain('viewBox="10 20 300 200"');
    expect(svg).toContain(">2</text>");
    expect(svg).toContain('fill="#1a1a1a"');
  });
});
