// @vitest-environment happy-dom
// The bar on a narrow viewport (Edvard, 2026-11-23: "make the bar shorter but still having the
// best UI/UX"; 2026-11-24: at ~700 px it must not stretch; in Chrome on a Mac, "Comment" ran past
// its cell and the ▾ halves were as wide as their tools). Its CSS under 768 px: a centred row as
// wide as its tools, each named under its icon in a cell as wide as the name needs, one even gap,
// a split button's ▾ a narrow segment against its tool; the wide bar hides More. The layout itself
// (the real widths, the ▾ narrower than its tool, the selected look covering its name) is checked in
// Chromium at phone and tablet sizes by scripts/narrow-check.mjs (run by hand: it needs the demo
// app and a Chromium).
import { describe, expect, it } from "vitest";
import { buttonName } from "../src/ui/compact";
import { CSS } from "../src/ui/css";
import { GAP } from "../src/ui/fit";
import { CARET, CELL_MIN, CELL_PAD } from "../src/ui/narrow-css";

const narrow = CSS.slice(CSS.indexOf("@media (max-width: 767px)"));

describe("the narrow bar's CSS", () => {
  it("is a centred row as wide as its tools, never stretched across the screen", () => {
    expect(narrow).toContain("width: max-content;");
    expect(narrow).toContain("justify-content: center;");
    expect(narrow).not.toContain("space-between");
    expect(CSS).toContain(".bar .more-toggle { display: none; }");
    expect(narrow).toContain(".bar .more-toggle { display: inline-flex; }");
  });

  it("sizes each cell by its own name with padding either side, so the selected look covers the name", () => {
    // Cells keep their own width (flex: none on the cell rule itself: the buttons' all: unset
    // outranks a general one): fit.ts measures them, so none is squeezed under its name.
    expect(narrow).toContain(
      `box-sizing: border-box; width: auto; min-width: ${CELL_MIN}px; height: 56px; padding: 0 ${CELL_PAD}px; flex-direction: column; gap: 4px; flex: none; }`,
    );
    expect(CELL_PAD).toBeGreaterThan(0);
    expect(narrow).toContain(".bar > button::after, .bar > .drawgroup > button.draw::after { content: attr(data-name);");
  });

  it("makes a split button one control: its ▾ narrower than any tool, as tall, against it", () => {
    expect(CARET).toBeLessThan(CELL_MIN);
    expect(narrow).toContain(`box-sizing: border-box; width: ${CARET}px; min-width: ${CARET}px; height: 56px; padding: 0; flex: none; }`);
    expect(narrow).toContain(".bar > .drawgroup > button.caret { border-left: 1px solid");
  });

  it("keeps one even gap between cells", () => {
    expect(narrow).toContain(`justify-content: center; gap: ${GAP}px;`);
  });

  it("keeps the sheet within 45% of the seen height, and its menus as wide as the bar", () => {
    expect(narrow).toContain("max-height: calc(var(--view-height, 100vh) * 0.45);");
    expect(narrow).toContain(".bar .drawmenu, .bar .copygroup .menu { left: 0; right: 0; width: auto;");
    expect(narrow).toContain('.bar[data-colors="hidden"] .colors { display: none !important; }');
  });
});

describe("a button's short name", () => {
  it("is the word a person looks for", () => {
    expect(buttonName("Use the page")).toBe("Page");
    expect(buttonName("Add an image (or paste: Ctrl+V)")).toBe("Image");
    expect(buttonName("Close Pointer")).toBe("Exit");
    expect(buttonName("More drawing tools")).toBe("Shapes");
    expect(buttonName("Choose what Copy gives, see its cost, preview it")).toBe("Options");
    expect(buttonName("Gap: drag from one element to another")).toBe("Gap");
    expect(buttonName("Move marks and images · Delete removes")).toBe("Move");
  });
});
