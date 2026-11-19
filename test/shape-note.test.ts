// @vitest-environment happy-dom
// Text typed on a box or an ellipse (Edvard, 2026-11-19): found by a double-click inside it,
// numbered after the pins, written under the shape, moving with it, kept through a reload, and
// read as "[5] box: make this one card". An empty text removes it; a new bubble cancels an old one.
import { describe, expect, it } from "vitest";
import { shapeNoteLine } from "../src/bundle/format";
import { fromSaved, toSaved } from "../src/keep/saved";
import { renderSvg } from "../src/marks/svg";
import type { Mark, Pin } from "../src/marks/types";
import { openBubble } from "../src/ui/bubble";
import { framedAt, moveShape, scenePins, shapeBox, shapeNotesOf } from "../src/ui/state";

const box = (note?: string): Mark => ({ kind: "box", color: "red", rect: { x: 100, y: 100, w: 200, h: 80 }, ...(note ? { note } : {}) });
const layout = { scroll: { x: 0, y: 0 }, rectOf: () => ({ x: 0, y: 0, w: 10, h: 10 }) };

describe("a note on a box or an ellipse", () => {
  it("a double-click inside the shape finds it; outside finds nothing", () => {
    const marks = [box()];
    expect(framedAt(marks, { x: 150, y: 140 })).toBe(marks[0]);
    expect(framedAt(marks, { x: 50, y: 50 })).toBeUndefined();
  });

  it("is numbered after the pins and reads as one line", () => {
    const pin: Pin = { kind: "comment", color: "red", el: document.body, at: { x: 0, y: 0 }, note: "x" };
    const marks: Mark[] = [box("make this one card"), pin, box()];
    expect(shapeNotesOf(marks, 1)).toEqual([{ n: 2, kind: "box", note: "make this one card" }]);
    expect(scenePins(marks, layout).map((p) => p.n)).toEqual([1, 2]);
    expect(shapeNoteLine({ n: 5, kind: "box", note: "make this\none card" })).toBe("[5] box: make this; one card");
  });

  it("is written under the shape, moves with it, and the picture makes room for it", () => {
    const s = box("bigger");
    const svg = renderSvg({ shapes: [s as never], pins: [] }, { x: 0, y: 0, w: 400, h: 300 });
    expect(svg).toContain('y="188"');
    expect(svg).toContain(">bigger</text>");
    const moved = moveShape(s as never, 10, 5);
    expect(moved).toMatchObject({ note: "bigger", rect: { x: 110, y: 105 } });
    expect(shapeBox(s as never).h).toBeGreaterThan(80);
  });

  it("survives a reload with the shape", () => {
    const { saved } = toSaved([box("one card")], { target: () => ({ selector: "", tag: "", label: "" }), editsOf: () => null, imageSrc: () => null });
    const back = fromSaved(JSON.parse(JSON.stringify(saved)), { find: () => null, at: () => null, image: () => new Image(), page: document.body });
    expect(back.marks[0]).toMatchObject({ kind: "box", note: "one card" });
  });
});

describe("the note box", () => {
  it("a new bubble cancels the open one as Esc would, so the first never waits forever", async () => {
    const root = document.createElement("div").attachShadow({ mode: "open" });
    const first = openBubble(root, { at: { x: 0, y: 0 }, placeholder: "Comment", hint: "" });
    const second = openBubble(root, { at: { x: 0, y: 0 }, placeholder: "Text on this box", hint: "" });
    expect(await first).toBeNull();
    expect(root.querySelectorAll(".bubble")).toHaveLength(1);
    const input = root.querySelector("textarea") as HTMLTextAreaElement;
    input.value = "";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(await second).toBe("");
  });
});
