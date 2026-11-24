// The bar as the tests build it: every action a no-op unless a test passes its own spy, on the page,
// showing the first state with no pick yet.
import { initialState } from "../src/ui/state";
import type { StylesLook } from "../src/ui/styles";
import { type BarActions, type Toolbar, createToolbar } from "../src/ui/toolbar";

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

/** The buttons a narrow bar keeps in its row, by name: neither in the sheet nor in a menu. */
export const inRow = (tb: Toolbar) =>
  [...tb.el.querySelectorAll<HTMLButtonElement>("button")].filter((b) => !b.closest(".sheet") && !b.closest(".menu")).map((b) => b.dataset.name);
