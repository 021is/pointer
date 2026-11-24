// What the narrow bar keeps at hand for the seen width (Edvard, 2026-11-24: at a mini tablet's
// ~700 px the full-width bar with five far-apart icons read as broken): as many tools as fit, in
// priority order, the first that does not fit ends the row; Text frees the picture tools' room.
import { describe, expect, it } from "vitest";
import { CARET, CELL, type Laid, PRIORITY, ROW_FRAME, Relayout, fitRow, relayout, seenPart } from "../src/ui/fit";
import { SHEET } from "../src/ui/sheet";

const row = (width: number, output: "picture" | "text" = "picture") => [...fitRow(width, output)];

describe("relayout", () => {
  const wide: Laid = { kind: "wide" };
  const phone: Laid = { kind: "narrow", width: 390, output: "picture" };

  it("keeps a layout that is the same as a whole", () => {
    expect(relayout(wide, wide)).toBe(Relayout.KEEP);
    expect(relayout(phone, { ...phone })).toBe(Relayout.KEEP);
  });

  it("closes the sheet and lays out again when the width changes", () => {
    expect(relayout(wide, phone)).toBe(Relayout.CLOSE_AND_ARRANGE);
    expect(relayout(phone, wide)).toBe(Relayout.CLOSE_AND_ARRANGE);
    expect(relayout(phone, { ...phone, width: 700 })).toBe(Relayout.CLOSE_AND_ARRANGE);
    expect(relayout(phone, { ...phone, width: 700, output: "text" })).toBe(Relayout.CLOSE_AND_ARRANGE);
  });

  it("lays out again with the sheet open when only the output changes", () => {
    expect(relayout(phone, { ...phone, output: "text" })).toBe(Relayout.ARRANGE);
  });
});

describe("the narrow bar's row", () => {
  it("keeps the five quick tools on a phone and adds more as the width grows", () => {
    expect(row(320)).toEqual(["pick", "comment", "draw", "undo", "copy"]);
    expect(row(390)).toEqual(["pick", "comment", "draw", "undo", "copy", "copyCaret"]);
    expect(row(600)).toEqual(["pick", "comment", "draw", "undo", "copy", "copyCaret", "drawCaret", "move", "icon", "crop", "idea"]);
    expect(row(700)).toEqual([...row(600), "image", "redo"]);
    expect(row(767)).toEqual([...row(700), "page"]);
  });

  it("never passes the seen width, More included", () => {
    for (const w of [320, 360, 390, 430, 600, 700, 767]) {
      const cells = row(w).reduce((sum, p) => sum + (p.endsWith("Caret") ? CARET : CELL), 0);
      expect(ROW_FRAME + cells + CELL, `${w}`).toBeLessThanOrEqual(w);
    }
  });

  it("in Text, leaves out what only a picture needs and takes the next ones", () => {
    expect(row(320, "text")).toEqual(["pick", "comment", "undo", "copy", "copyCaret"]);
    expect(row(700, "text").some((p) => ["draw", "drawCaret", "icon", "image", "crop"].includes(p))).toBe(false);
  });

  it("keeps a menu's ▾ only beside its own button", () => {
    for (const w of [320, 390, 430, 600, 700, 767]) {
      const r = row(w);
      if (r.includes("drawCaret")) expect(r).toContain("draw");
      if (r.includes("copyCaret")) expect(r).toContain("copy");
    }
  });

  it("ranks only parts the sheet can also hold, the colours and Picture | Text never in the row", () => {
    const placed = SHEET.flatMap((g) => g.parts);
    expect(PRIORITY.every((p) => placed.includes(p))).toBe(true);
    expect(PRIORITY).not.toContain("colors");
    expect(PRIORITY).not.toContain("output");
  });

  it("shows the colours only with a tool they colour, and no picture part in Text", () => {
    expect(seenPart("colors", "picture", true)).toBe(true);
    expect(seenPart("colors", "picture", false)).toBe(false);
    expect(seenPart("crop", "text", true)).toBe(false);
    expect(seenPart("idea", "text", false)).toBe(true);
  });
});
