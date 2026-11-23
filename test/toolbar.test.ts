// @vitest-environment happy-dom
// The bar's Picture | Text switch, beside the Copy menu (Edvard, 2026-11-18: keep the switch).
import { describe, expect, it, vi } from "vitest";
import { initialState } from "../src/ui/state";
import type { StylesLook } from "../src/ui/styles";
import { createToolbar } from "../src/ui/toolbar";

const EMPTY: StylesLook = { state: "empty", tip: "Styles: no pick yet" };

function bar() {
  const output = vi.fn();
  const noop = () => {};
  const tb = createToolbar({
    screen: document.createElement("span"),
    tool: noop,
    color: noop,
    output,
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
  const part = (label: string) => tb.el.querySelector<HTMLButtonElement>(`.switch button[aria-label^="${label}"]`);
  return { tb, output, picture: part("Copy gives a picture"), text: part("Copy gives the text only") };
}

describe("Picture | Text switch", () => {
  it("each side sets what Copy gives", () => {
    const { output, text, picture } = bar();
    text?.click();
    picture?.click();
    expect(output.mock.calls).toEqual([["text"], ["picture"]]);
  });

  it("Picture stays lit for Picture only, and Copy names the difference", () => {
    const { tb, picture, text } = bar();
    tb.update({ ...initialState(), output: "image" }, EMPTY);
    expect(picture?.getAttribute("aria-pressed")).toBe("true");
    expect(text?.getAttribute("aria-pressed")).toBe("false");
    expect(tb.el.querySelector(".copy .mode")?.textContent).toBe("· Picture only");
    tb.update({ ...initialState(), output: "text" }, EMPTY);
    expect(text?.getAttribute("aria-pressed")).toBe("true");
    expect(tb.el.querySelector(".copy .mode")?.textContent).toBe("");
  });
});
