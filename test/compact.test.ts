// @vitest-environment happy-dom
// The bar on a narrow viewport (Edvard, 2026-11-23: "make the bar shorter but still having the
// best UI/UX"): Pick, Comment, Draw, Undo and Copy stay one tap away, everything else waits behind
// one More; More opens every tool with its name, a choice closes it, so do Esc and a press outside
// (which does nothing else). The layout is CSS under 768 px, checked by hand in Chromium.
import { afterEach, describe, expect, it, vi } from "vitest";
import { buttonName } from "../src/ui/compact";
import { CSS } from "../src/ui/css";
import { initialState } from "../src/ui/state";
import { createToolbar } from "../src/ui/toolbar";

afterEach(() => {
  document.body.innerHTML = "";
});

function bar() {
  const tool = vi.fn();
  const noop = () => {};
  const tb = createToolbar({
    tool,
    color: noop,
    output: noop,
    upload: noop,
    styles: noop,
    undo: noop,
    redo: noop,
    clear: noop,
    copy: noop,
    copyAs: noop,
    preview: noop,
    clearAfterCopy: noop,
    estimate: async () => ({ picture: 0, text: 0, image: 0 }),
    close: noop,
  });
  document.body.append(tb.el);
  tb.update(initialState(), { state: "empty", tip: "Styles: no pick yet" });
  const toggle = tb.el.querySelector<HTMLButtonElement>("button.more-toggle") as HTMLButtonElement;
  /** The buttons a narrow bar shows with More closed. */
  const atHand = () =>
    [...tb.el.querySelectorAll<HTMLButtonElement>("button")]
      .filter((b) => !b.closest('[data-tier="more"]') && !b.closest(".menu"))
      .map((b) => b.dataset.name);
  return { tb, tool, toggle, atHand };
}

describe("the narrow bar", () => {
  it("keeps Pick, Comment, Draw, Undo and Copy one tap away, and one More for the rest", () => {
    const { atHand } = bar();
    expect(atHand()).toEqual(["Pick", "Comment", "Pen", "Undo", "Copy", "More"]);
  });

  it("puts every other tool behind More, each with a name to show under its icon", () => {
    const { tb } = bar();
    const behind = [...tb.el.querySelectorAll('[data-tier="more"]')].flatMap((el) =>
      el.matches("button") ? [el] : [...el.querySelectorAll("button")],
    );
    expect(behind.map((b) => (b as HTMLElement).dataset.name)).toEqual(
      expect.arrayContaining(["Page", "Move", "Idea", "Crop", "Icon", "Red", "Image", "Styles", "Redo", "Clear", "Close"]),
    );
    expect(behind.every((b) => (b as HTMLElement).dataset.name)).toBe(true);
  });

  it("More opens and closes; a tool chosen in it closes it", () => {
    const { tb, toggle, tool } = bar();
    toggle.click();
    expect(tb.el.dataset.more).toBe("open");
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    tb.el.querySelector<HTMLButtonElement>('button[aria-label^="Crop"]')?.click();
    expect(tool).toHaveBeenCalledWith("crop");
    expect(tb.el.dataset.more).toBeUndefined();
    toggle.click();
    toggle.click();
    expect(tb.el.dataset.more).toBeUndefined();
  });

  it("Esc closes it first (collapse says it was open), and a press outside only closes it", () => {
    const { tb, toggle } = bar();
    toggle.click();
    expect(tb.collapse()).toBe(true);
    expect(tb.collapse()).toBe(false);
    toggle.click();
    const press = new PointerEvent("pointerdown", { bubbles: true, cancelable: true });
    const page = vi.fn();
    document.body.addEventListener("pointerdown", page);
    document.body.dispatchEvent(press);
    expect(tb.el.dataset.more).toBeUndefined();
    expect(press.defaultPrevented).toBe(true);
    expect(page).not.toHaveBeenCalled();
  });

  it("is laid out under 768 px only, its targets 48 px, its menus as wide as the bar", () => {
    const narrow = CSS.slice(CSS.indexOf("@media (max-width: 767px)"));
    expect(narrow).toContain(".bar button, .bar button.swatch { height: 48px; min-width: 48px; }");
    expect(narrow).toContain('.bar:not([data-more="open"]) [data-tier="more"] { display: none !important; }');
    expect(narrow).toContain(".bar .drawmenu, .bar .copygroup .menu { left: 0; right: 0; width: auto;");
    expect(CSS).toContain(".bar .more-toggle { display: none; }");
  });

  it("names a button by the word a person looks for", () => {
    expect(buttonName("Use the page")).toBe("Page");
    expect(buttonName("Add an image (or paste: Ctrl+V)")).toBe("Image");
    expect(buttonName("Gap: drag from one element to another")).toBe("Gap");
    expect(buttonName("Move marks and images · Delete removes")).toBe("Move");
  });
});
