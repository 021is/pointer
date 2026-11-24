// @vitest-environment happy-dom
// The bar's Picture | Text switch, beside the Copy menu (Edvard, 2026-11-18: keep the switch).
import { afterEach, describe, expect, it, vi } from "vitest";
import { initialState } from "../src/ui/state";
import { NO_PICK, makeBar } from "./bar";

afterEach(() => {
  document.body.innerHTML = "";
});

function bar() {
  const output = vi.fn();
  const tb = makeBar({ output });
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
    tb.update({ ...initialState(), output: "image" }, NO_PICK);
    expect(picture?.getAttribute("aria-pressed")).toBe("true");
    expect(text?.getAttribute("aria-pressed")).toBe("false");
    expect(tb.el.querySelector(".copy .mode")?.textContent).toBe("· Picture only");
    tb.update({ ...initialState(), output: "text" }, NO_PICK);
    expect(text?.getAttribute("aria-pressed")).toBe("true");
    expect(tb.el.querySelector(".copy .mode")?.textContent).toBe("");
  });
});
