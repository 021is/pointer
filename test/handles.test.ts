import { describe, expect, it } from "vitest";
import type { Mark } from "../src/marks/types";
import { textAt } from "../src/ui/handles";
import { pictureOnly } from "../src/ui/state";

describe("textAt: a drawn text under the mouse can be grabbed", () => {
  const marks: Mark[] = [
    { kind: "text", color: "red", at: { x: 100, y: 100 }, text: "first" },
    { kind: "box", color: "red", rect: { x: 0, y: 0, w: 500, h: 500 } },
    { kind: "text", color: "blue", at: { x: 110, y: 105 }, text: "on top" },
  ];

  it("finds the topmost text, with a little slack around it", () => {
    expect(textAt(marks, { x: 115, y: 110 })).toMatchObject({ text: "on top" });
    expect(textAt(marks, { x: 98, y: 98 })).toMatchObject({ text: "first" });
  });

  it("ignores shapes and empty space", () => {
    expect(textAt(marks, { x: 400, y: 400 })).toBeUndefined();
  });
});

describe("pictureOnly: what the bar hides in Text", () => {
  it("drawing and cropping need a picture; picking and commenting do not", () => {
    expect(["crop", "pen", "arrow", "box", "ellipse", "text"].every((t) => pictureOnly(t as never))).toBe(true);
    expect(["page", "pick", "comment"].some((t) => pictureOnly(t as never))).toBe(false);
  });
});
