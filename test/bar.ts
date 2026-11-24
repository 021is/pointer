// The bar as the tests build it: every action a no-op unless a test passes its own spy, on the page,
// showing the first state with no pick yet.
import { vi } from "vitest";
import { initialState } from "../src/ui/state";
import type { StylesLook } from "../src/ui/styles";
import { type BarActions, type Toolbar, createToolbar } from "../src/ui/toolbar";
import { RECORDED } from "./recorded-widths";

export const NO_PICK: StylesLook = { state: "empty", tip: "Styles: no pick yet" };

export function makeBar(spies: Partial<BarActions> = {}): Toolbar {
  const noop = () => {};
  const tb = createToolbar({
    tool: noop,
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
    ...spies,
  });
  document.body.append(tb.el);
  tb.update(initialState(), NO_PICK);
  return tb;
}

/** A row cell's width as Chromium laid it out (recorded-widths.ts), for happy-dom, which lays
 *  nothing out; an element that is no named row cell is 0 wide there too. */
export function cellWidth(el: Element): number {
  const name = el instanceof HTMLElement ? el.dataset.name : undefined;
  return (name && RECORDED[name]) || 0;
}

/** Makes every element report its cellWidth, so the bar's fit (fit.ts) measures as in a browser. */
export function layOutCells(): void {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    return new DOMRect(0, 0, cellWidth(this), 56);
  });
}

/** The buttons a narrow bar keeps in its row, by name: neither in the sheet nor in a menu. */
export const inRow = (tb: Toolbar) =>
  [...tb.el.querySelectorAll<HTMLButtonElement>("button")].filter((b) => !b.closest(".sheet") && !b.closest(".menu")).map((b) => b.dataset.name);
