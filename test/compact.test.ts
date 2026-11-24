// @vitest-environment happy-dom
// The bar on a narrow viewport (Edvard, 2026-11-23: "make the bar shorter but still having the
// best UI/UX"; 2026-11-24: at ~700 px it must not stretch). Its CSS under 768 px: a centred row as
// wide as its tools, each named under its icon, cells as wide as fit.ts counts them; the wide bar
// hides More. The layout itself is checked in Chromium at phone and tablet sizes by
// scripts/narrow-check.mjs (run by hand: it needs the demo app and a Chromium).
import { describe, expect, it } from "vitest";
import { buttonName } from "../src/ui/compact";
import { CSS } from "../src/ui/css";
import { CARET, CELL } from "../src/ui/fit";

const narrow = CSS.slice(CSS.indexOf("@media (max-width: 767px)"));

describe("the narrow bar's CSS", () => {
  it("is a centred row as wide as its tools, never stretched across the screen", () => {
    expect(narrow).toContain("width: max-content;");
    expect(narrow).toContain("justify-content: center;");
    expect(narrow).not.toContain("space-between");
    expect(CSS).toContain(".bar .more-toggle { display: none; }");
    expect(narrow).toContain(".bar .more-toggle { display: inline-flex; }");
  });

  it("sizes its cells as fit.ts counts them, each name under its icon", () => {
    expect(narrow).toContain(`width: ${CELL}px; min-width: ${CELL}px; height: 56px; padding: 0; flex-direction: column;`);
    expect(narrow).toContain(`width: ${CARET}px; min-width: ${CARET}px; height: 56px;`);
    expect(narrow).toContain(".bar > button::after, .bar > .drawgroup > button.draw::after { content: attr(data-name);");
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
