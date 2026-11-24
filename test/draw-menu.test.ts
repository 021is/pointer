// @vitest-environment happy-dom
// The grouped bar's draw button (Edvard, 2026-11-19: "draw tools in one button"): a key switches
// the tool it shows; ▾ or a second press opens the other five; arrows, Enter and Esc work.
import { describe, expect, it, vi } from "vitest";
import { initialState } from "../src/ui/state";
import type { Tool } from "../src/ui/state";
import { NO_PICK, makeBar } from "./bar";

function bar() {
  const tool = vi.fn();
  const tb = makeBar({ tool });
  const show = (t: Tool) => tb.update({ ...initialState(), tool: t }, NO_PICK);
  const q = <T extends Element>(sel: string) => tb.el.querySelector(sel) as T;
  const menu = () => q<HTMLElement>(".drawmenu");
  const names = () => [...menu().querySelectorAll(".name")].map((n) => n.textContent);
  return { tb, tool, show, main: () => q<HTMLButtonElement>("button.draw"), caret: () => q<HTMLButtonElement>(".drawgroup button.caret"), menu, names };
}

describe("the draw button", () => {
  it("holds the six drawing tools and the bar keeps the others as their own buttons", () => {
    const { tb, main } = bar();
    expect(main().getAttribute("aria-label")).toBe("Pen · Shift: straight (D)");
    for (const label of ["Use the page", "Move", "Pick", "Comment", "Idea", "Crop", "Icon"]) {
      expect(tb.el.querySelector(`.group > button[aria-label^="${label}"]`)).not.toBeNull();
    }
    expect(tb.el.querySelector('.group > button[aria-label^="Box"]')).toBeNull();
  });

  it("Text hides what only a picture needs: crop, the drawing button, icons, colours, image", () => {
    const { tb } = bar();
    const hidden = (el: Element | null) => el?.closest('[data-only="picture"]') !== null;
    const q = (sel: string) => tb.el.querySelector(sel);
    expect(hidden(q("button.draw"))).toBe(true);
    expect(hidden(q('button[aria-label^="Icon"]'))).toBe(true);
    expect(hidden(q('button[aria-label^="Crop"]'))).toBe(true);
    expect(hidden(q('button[aria-label^="Add an image"]'))).toBe(true);
    expect(hidden(q("button.swatch"))).toBe(true);
    for (const label of ["Use the page", "Move", "Pick", "Comment", "Idea", "Undo", "Copy for the agent"]) {
      expect(hidden(q(`button[aria-label^="${label}"]`))).toBe(false);
    }
  });

  it("a key's tool shows on the button, and stays there as the last one used", () => {
    const { show, main } = bar();
    show("box");
    expect(main().getAttribute("aria-label")).toBe("Box · Shift: square (B)");
    expect(main().getAttribute("aria-pressed")).toBe("true");
    show("comment");
    expect(main().getAttribute("aria-label")).toBe("Box · Shift: square (B)");
    expect(main().getAttribute("aria-pressed")).toBe("false");
  });

  it("a press uses its tool; a second press opens the other five; ▾ toggles it", () => {
    const { tool, show, main, caret, menu, names } = bar();
    show("comment");
    main().click();
    expect(tool).toHaveBeenLastCalledWith("pen");
    expect(menu().hidden).toBe(true);
    show("pen");
    main().click();
    expect(menu().hidden).toBe(false);
    expect(names()).toEqual(["Arrow", "Box", "Ellipse", "Gap", "Text"]);
    caret().click();
    expect(menu().hidden).toBe(true);
  });

  it("by keyboard: the first item takes focus, arrows move, Enter takes, Esc closes", () => {
    const { tool, caret, menu } = bar();
    caret().click();
    const items = [...menu().querySelectorAll<HTMLButtonElement>("button")];
    expect(document.activeElement === items[0] || items[0]?.matches(":focus")).toBe(true);
    items[0]?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(items[1]?.matches(":focus") || document.activeElement === items[1]).toBe(true);
    items[1]?.click();
    expect(tool).toHaveBeenLastCalledWith("box");
    expect(menu().hidden).toBe(true);
    caret().click();
    menu().querySelector("button")?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(menu().hidden).toBe(true);
    expect(menu().hasAttribute("data-own-keys")).toBe(true);
  });
});
