// @vitest-environment happy-dom
// The narrow bar and its tool sheet (Edvard, 2026-11-24, before 1.1.0): the row keeps what fits,
// More opens the sheet with only the rest in three named groups, Mark, Edit and Send, every tool
// in exactly one; the colours only with Pen or Icon; More says Close while it is open; Esc, a press
// outside, a drag down and a chosen tool close it, while Undo, Redo, Clear, a colour and Picture |
// Text leave it open. The wide bar keeps its own order.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DRAG_CLOSE } from "../src/ui/compact";
import { SHEET } from "../src/ui/sheet";
import { type Tool, initialState } from "../src/ui/state";
import { type Toolbar, TOOLS, colorsShown } from "../src/ui/toolbar";
import { NO_PICK, inRow, layOutCells, makeBar } from "./bar";

/** The seen width as DevTools' device mode sets it; app.ts updates the bar on the resize. */
const at = (width: number) => window.happyDOM.setViewport({ width, height: 844 });

beforeEach(layOutCells);

afterEach(() => {
  at(1024);
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

const q = (tb: Toolbar, sel: string) => tb.el.querySelector<HTMLElement>(sel) as HTMLElement;
const more = (tb: Toolbar) => q(tb, "button.more-toggle");
const isOpen = (tb: Toolbar) => tb.el.dataset.more === "open";
const show = (tb: Toolbar, tool: Tool = "comment", output: "picture" | "text" = "picture") =>
  tb.update({ ...initialState(), tool, output }, NO_PICK);
const inSheet = (tb: Toolbar, group: string) =>
  [...tb.el.querySelectorAll<HTMLElement>(`.sheet [data-group="${group}"] .cells button`)].filter((b) => !b.closest(".menu")).map((b) => b.dataset.name);

function phoneSheet(spies: Parameters<typeof makeBar>[0] = {}) {
  at(390);
  const tb = makeBar(spies);
  more(tb).click();
  expect(isOpen(tb)).toBe(true);
  return tb;
}

describe("the row and the sheet", () => {
  it("give every tool exactly one group, and every part one place", () => {
    const placed = SHEET.flatMap((g) => g.parts);
    expect(SHEET.map((g) => g.name)).toEqual(["Mark", "Edit", "Send"]);
    expect(new Set(placed).size).toBe(placed.length);
    for (const t of TOOLS) {
      const part = t.group === "draw" ? "draw" : t.tool;
      expect(placed.filter((p) => p === part), t.tool).toHaveLength(1);
    }
  });

  it("a bar measured before it is laid out (nothing has a width yet) is measured again on the next update", () => {
    vi.restoreAllMocks(); // every element 0 wide, as before the first paint
    at(390);
    const tb = makeBar();
    layOutCells();
    show(tb);
    expect(inRow(tb)).toEqual(["Pick", "Comment", "Pen", "Shapes", "Undo", "Copy", "Options", "More"]);
  });

  it("on a 320 px phone: the five quick tools and More; both menus' ▾ wait in the sheet", () => {
    at(320);
    const tb = makeBar();
    expect(inRow(tb)).toEqual(["Pick", "Comment", "Pen", "Undo", "Copy", "More"]);
    more(tb).click();
    expect(inSheet(tb, "mark")).toContain("Shapes");
    expect(inSheet(tb, "send")).toContain("Options");
  });

  it("on a phone: the quick tools with their ▾ and More in the row; the rest in the sheet, never both", () => {
    const tb = phoneSheet();
    expect(inRow(tb)).toEqual(["Pick", "Comment", "Pen", "Shapes", "Undo", "Copy", "Options", "Close"]);
    expect(inSheet(tb, "mark")).toEqual(["Idea", "Icon", "Image", "Crop", "Red", "Blue", "Yellow"]);
    expect(inSheet(tb, "edit")).toEqual(["Page", "Move", "Redo", "Clear", "Styles"]);
    const send = [...tb.el.querySelectorAll('.sheet [data-group="send"] button')].map((b) => b.getAttribute("aria-label"));
    expect(send).toEqual(["Copy gives a picture (I)", "Copy gives the text only, ~3× cheaper (I)"]);
    expect(q(tb, ".sheet-head button").dataset.name).toBe("Exit");
    const labels = [...tb.el.querySelectorAll("button")].filter((b) => !b.closest(".menu")).map((b) => b.getAttribute("aria-label"));
    expect(new Set(labels).size).toBe(labels.length);
    at(1024);
    expect(makeBar().el.querySelectorAll("button").length).toBe(tb.el.querySelectorAll("button").length);
  });

  it("on a small tablet: more tools in the row, in the wide bar's order, fewer in the sheet", () => {
    at(700);
    const tb = makeBar();
    expect(inRow(tb)).toEqual(["Move", "Pick", "Comment", "Idea", "Crop", "Pen", "Shapes", "Icon", "Image", "Undo", "Redo", "Copy", "Options", "More"]);
    expect(inSheet(tb, "edit")).toEqual(["Page", "Clear", "Styles"]);
    expect(q(tb, '.sheet [data-group="mark"]').hidden).toBe(true);
    show(tb, "pen");
    expect(q(tb, '.sheet [data-group="mark"]').hidden).toBe(false);
  });

  it("lays out again when the width changes, closing the sheet, and goes back to the wide bar's groups", () => {
    const tb = makeBar();
    tb.el.style.left = "40px";
    at(390);
    show(tb);
    expect(tb.el.style.left).toBe("");
    expect(inRow(tb)).toEqual(["Pick", "Comment", "Pen", "Shapes", "Undo", "Copy", "Options", "More"]);
    more(tb).click();
    at(600);
    show(tb);
    expect(isOpen(tb)).toBe(false);
    expect(inRow(tb)).toContain("Crop");
    at(1024);
    show(tb);
    expect(tb.el.querySelector(".sheet")).toBeNull();
    expect(tb.el.firstElementChild?.className).toBe("grip");
    expect(tb.el.querySelector(".group > button.caret, .drawgroup > button.caret")).not.toBeNull();
  });

  it("Picture | Text lays the row out again and keeps the sheet open and the pressed button focused", () => {
    const output = vi.fn();
    const tb = phoneSheet({ output });
    const text = q(tb, 'button[aria-label^="Copy gives the text only"]');
    text.focus();
    text.click();
    show(tb, "comment", "text");
    expect(output).toHaveBeenCalledWith("text");
    expect(isOpen(tb)).toBe(true);
    expect(document.activeElement).toBe(text);
    expect(inRow(tb)).not.toContain("Pen");
  });
});

describe("the colours in the sheet", () => {
  it("show only while a drawing tool or Icon is the tool", () => {
    const shown = TOOLS.filter((t) => colorsShown(t.tool)).map((t) => t.tool);
    expect(shown).toEqual(["pen", "arrow", "box", "ellipse", "gap", "text", "icon"]);
    const tb = phoneSheet();
    expect(tb.el.dataset.colors).toBe("hidden");
    show(tb, "pen");
    expect(tb.el.dataset.colors).toBe("shown");
    show(tb, "icon");
    expect(tb.el.dataset.colors).toBe("shown");
  });
});

describe("More and Close", () => {
  it("More turns into Close while the sheet is open, and back", () => {
    at(390);
    const toggle = more(makeBar());
    const look = () => [toggle.dataset.name, toggle.getAttribute("aria-label"), toggle.getAttribute("aria-expanded"), toggle.innerHTML];
    const closed = look();
    expect(closed.slice(0, 3)).toEqual(["More", "More tools", "false"]);
    expect(toggle.getAttribute("aria-controls")).toBe("pointer-sheet");
    toggle.click();
    expect(look().slice(0, 3)).toEqual(["Close", "Close the tools", "true"]);
    expect(look()[3]).not.toBe(closed[3]);
    toggle.click();
    expect(look()).toEqual(closed);
  });
});

describe("closing the sheet", () => {
  it("Esc closes it first (collapse says it was open)", () => {
    const tb = phoneSheet();
    expect(tb.collapse()).toBe(true);
    expect(tb.collapse()).toBe(false);
    expect(more(tb).dataset.name).toBe("More");
  });

  it("a press outside only closes it", () => {
    const tb = phoneSheet();
    const page = vi.fn();
    document.body.addEventListener("pointerdown", page);
    const press = new PointerEvent("pointerdown", { bubbles: true, cancelable: true });
    document.body.dispatchEvent(press);
    expect(isOpen(tb)).toBe(false);
    expect(press.defaultPrevented).toBe(true);
    expect(page).not.toHaveBeenCalled();
  });

  it("a drag down closes it past its threshold, a short or cancelled one springs back", () => {
    const tb = phoneSheet();
    const drag = (from: Element, dy: number, end: "pointerup" | "pointercancel" = "pointerup") => {
      from.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientY: 500 }));
      window.dispatchEvent(new PointerEvent("pointermove", { clientY: 500 + dy }));
      const followed = tb.el.style.getPropertyValue("--drag");
      window.dispatchEvent(new PointerEvent(end, { clientY: 500 + dy }));
      return followed;
    };
    const title = q(tb, ".sheet-title");
    expect(drag(title, DRAG_CLOSE - 10)).toBe(`${DRAG_CLOSE - 10}px`);
    expect(isOpen(tb)).toBe(true);
    expect(tb.el.style.getPropertyValue("--drag")).toBe("");
    drag(title, DRAG_CLOSE + 40, "pointercancel");
    expect(isOpen(tb)).toBe(true);
    drag(q(tb, '.sheet button[aria-label^="Idea"]'), DRAG_CLOSE + 40);
    expect(isOpen(tb)).toBe(true);
    drag(q(tb, 'button[aria-label^="Pick"]'), DRAG_CLOSE + 40);
    expect(isOpen(tb)).toBe(true);
    drag(q(tb, ".sheet-head"), DRAG_CLOSE);
    expect(isOpen(tb)).toBe(false);
  });

  it("a tool chosen closes it; Undo, Redo, Clear, a colour and Picture | Text leave it open", () => {
    const tool = vi.fn();
    const undo = vi.fn();
    const tb = phoneSheet({ tool, undo });
    for (const label of ["Undo", "Redo", "Clear everything", "Blue", "Copy gives the text only"]) {
      q(tb, `button[aria-label^="${label}"]`).click();
      expect(isOpen(tb), label).toBe(true);
    }
    expect(undo).toHaveBeenCalledTimes(1);
    q(tb, 'button[aria-label^="Idea"]').click();
    expect(tool).toHaveBeenCalledWith("idea");
    expect(isOpen(tb)).toBe(false);
  });

  it.each([
    ["Draw's", 320, "More drawing tools", ".drawmenu"],
    ["Copy's", 320, "Choose what Copy gives", ".copygroup .menu"],
  ])("%s ▾ in the sheet opens its menu above the bar, and a second press closes it", (_, width, label, menuAt) => {
    at(width);
    const tb = makeBar();
    more(tb).click();
    const caret = q(tb, `.sheet button[aria-label^="${label}"]`);
    const menu = q(tb, menuAt);
    const press = () => {
      caret.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, composed: true }));
      caret.click();
    };
    press();
    expect(isOpen(tb)).toBe(false);
    expect(menu.hidden).toBe(false);
    press();
    expect(menu.hidden).toBe(true);
  });
});
