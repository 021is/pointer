// What the narrow bar keeps at hand for the seen width (Edvard, 2026-11-24: at a mini tablet's
// ~700 px the full-width bar with five far-apart icons read as broken; in Chrome on a Mac the
// widths are measured, never assumed): Copy and More always, then as many tools as the measured
// widths fit, in priority order, the first that does not fit ending the row; one gap per cell,
// none before a ▾; Text frees the picture tools' room.
import { describe, expect, it } from "vitest";
import { GAP, type Laid, PRIORITY, ROW_FRAME, Relayout, type Sizes, fitRow, relayout, seenPart } from "../src/ui/fit";
import { type Part, SHEET, isCaret } from "../src/ui/sheet";
import { NAME_OF, RECORDED } from "./recorded-widths";

/** Each part's width as a recorded narrow-check.mjs run measured it (recorded-widths.ts). */
function of(p: Part): number {
  const w = RECORDED[NAME_OF[p] ?? ""];
  if (w === undefined) throw new Error(`no recorded width for ${p}`);
  return w;
}
const sizes: Sizes = { of, more: RECORDED.More ?? 0 };
const row = (width: number, output: "picture" | "text" = "picture") => {
  const kept = fitRow(width, output, sizes);
  return PRIORITY.filter((p) => kept.has(p));
};

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
    // The same rows scripts/narrow-check.mjs printed in the recorded run.
    expect(row(320)).toEqual(["pick", "comment", "draw", "undo", "copy"]);
    expect(row(390)).toEqual(["pick", "comment", "draw", "undo", "copy", "copyCaret", "drawCaret"]);
    expect(row(430)).toEqual([...row(390), "move"]);
    expect(row(530)).toEqual([...row(430), "icon", "crop"]);
    expect(row(600)).toEqual([...row(530), "idea", "image"]);
    expect(row(700)).toEqual([...row(600), "redo", "page"]);
    expect(row(767)).toEqual([...row(700), "clear"]);
  });

  it("never passes the seen width: its cells, one gap between cells, none before a ▾, and More", () => {
    for (const w of [320, 360, 390, 430, 530, 600, 700, 767]) {
      const cells = row(w).reduce((sum, p) => sum + of(p) + (isCaret(p) ? 0 : GAP), 0);
      expect(ROW_FRAME + cells + sizes.more, `${w}`).toBeLessThanOrEqual(w);
    }
  });

  it("measures: a wider name takes more room, so fewer tools fit", () => {
    const wider: Sizes = { of: (p) => of(p) + 10, more: 54 };
    expect(fitRow(390, "picture", wider).size).toBeLessThan(fitRow(390, "picture", sizes).size);
  });

  it("always keeps Copy, however narrow", () => {
    expect([...fitRow(150, "picture", sizes)]).toEqual(["copy"]);
  });

  it("in Text, leaves out what only a picture needs and takes the next ones", () => {
    expect(row(320, "text")).toEqual(["pick", "comment", "undo", "copy", "copyCaret"]);
    expect(row(700, "text").some((p) => ["draw", "drawCaret", "icon", "image", "crop"].includes(p))).toBe(false);
  });

  it("keeps a menu's ▾ only beside its own button", () => {
    for (const w of [320, 390, 430, 530, 600, 700, 767]) {
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
