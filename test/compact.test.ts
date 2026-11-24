// @vitest-environment happy-dom
// The bar on a narrow viewport (Edvard, 2026-11-23: "make the bar shorter but still having the
// best UI/UX"; 2026-11-24: at ~700 px it must not stretch; last round, in Chrome on a Mac: icons
// only below 768 px, and Copy no white slab). Its CSS under 768 px: a centred row as wide as its
// tools, every cell a 44 px icon square, one even gap, a split button's ▾ a narrow segment against
// its tool, Copy one teal pill apart from the selected tool's violet; the wide bar hides More. The
// layout itself (squares, icons centred, ▾ against its tool, even gaps, Copy's contrast as drawn) is
// checked in Chromium at 8 sizes by scripts/narrow-check.mjs, which CI runs.
import { describe, expect, it } from "vitest";
import { buttonName } from "../src/ui/compact";
import { CSS } from "../src/ui/css";
import { GAP } from "../src/ui/fit";
import { CARET, CELL, COPY_FILL, COPY_HOVER } from "../src/ui/narrow-css";

const narrow = CSS.slice(CSS.indexOf("@media (max-width: 767px)"));

/** WCAG 2.x contrast of two #rrggbb colours. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (bl ?? 0);
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

describe("the narrow bar's CSS", () => {
  it("is a centred row as wide as its tools, never stretched across the screen", () => {
    expect(narrow).toContain("width: max-content;");
    expect(narrow).toContain("justify-content: center;");
    expect(narrow).not.toContain("space-between");
    expect(CSS).toContain(".bar .more-toggle { display: none; }");
    expect(narrow).toContain(".bar .more-toggle { display: inline-flex; }");
  });

  it("shows icons only: every cell a 44 px square that keeps its size, no name under it", () => {
    // flex: none on the cell rule itself: the buttons' all: unset outranks a general one.
    expect(narrow).toContain(`box-sizing: border-box; width: ${CELL}px; min-width: ${CELL}px; height: ${CELL}px; padding: 0; gap: 0; flex: none; }`);
    expect(CELL).toBeGreaterThanOrEqual(44);
    expect(narrow).not.toContain(".bar > button::after");
    expect(narrow).toContain(".bar > .copygroup > button.copy .label, .bar .copy .mode { display: none; }");
  });

  it("makes a split button one control: its ▾ narrower than its tool, as tall, against it", () => {
    expect(CARET).toBeLessThan(CELL);
    expect(narrow).toContain(`box-sizing: border-box; width: ${CARET}px; min-width: ${CARET}px; height: ${CELL}px; padding: 0; flex: none;`);
    expect(narrow).toContain(".bar > .drawgroup > button.caret { border-left: 1px solid");
    expect(narrow).toContain(".bar > .copygroup > button.caret { border-left: 1px solid");
  });

  it("makes Copy one teal pill: its white icon at least 3:1, apart from the bar's glass and the tool's violet", () => {
    expect(narrow).toContain(`color: #fff; background: ${COPY_FILL};`);
    expect(contrast("#ffffff", COPY_FILL)).toBeGreaterThanOrEqual(3);
    expect(contrast("#ffffff", COPY_HOVER)).toBeGreaterThanOrEqual(3);
    // The bar's glass is the same dark on a light or a dark page; its darkest stop is #12101c.
    expect(contrast(COPY_FILL, "#12101c")).toBeGreaterThanOrEqual(3);
    for (const violet of ["#8a6dff", "#6a4cf0"]) expect(COPY_FILL).not.toBe(violet);
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
