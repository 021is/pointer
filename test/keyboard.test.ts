// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { keyHandler } from "../src/ui/keyboard";
import { actions } from "./key-actions";

const press = (handler: (e: KeyboardEvent) => void, key: string) => {
  const e = new KeyboardEvent("keydown", { key, cancelable: true });
  document.body.dispatchEvent(e);
  handler(e);
  return e;
};

describe("keyHandler", () => {
  it("leaves Delete, Backspace, [ and ] to the page when no pasted image is under the mouse", () => {
    const run = actions(false);
    const handle = keyHandler(() => "pick", run).keydown;
    for (const key of ["Delete", "Backspace", "[", "]"]) expect(press(handle, key).defaultPrevented).toBe(false);
    expect(run.remove).not.toHaveBeenCalled();
    expect(run.see).not.toHaveBeenCalled();
  });

  it("takes them over a pasted image", () => {
    const run = actions(true);
    const handle = keyHandler(() => "pick", run).keydown;
    expect(press(handle, "Delete").defaultPrevented).toBe(true);
    press(handle, "[");
    expect(run.remove).toHaveBeenCalledOnce();
    expect(run.see).toHaveBeenCalledWith(-1);
  });

  it("Cmd+V and Ctrl+V outside a field steer the paste to Pointer and leave the key alone (macOS)", () => {
    const run = actions(false);
    const handle = keyHandler(() => "pick", run).keydown;
    for (const mods of [{ metaKey: true }, { ctrlKey: true }]) {
      const e = new KeyboardEvent("keydown", { key: "v", cancelable: true, ...mods });
      handle(e);
      expect(e.defaultPrevented).toBe(false);
    }
    expect(run.beforePaste).toHaveBeenCalledTimes(2);
  });

  it("plain V and Alt+Cmd+V are not a paste", () => {
    const run = actions(false);
    const handle = keyHandler(() => "pick", run).keydown;
    handle(new KeyboardEvent("keydown", { key: "v", cancelable: true }));
    handle(new KeyboardEvent("keydown", { key: "v", metaKey: true, altKey: true, cancelable: true }));
    expect(run.beforePaste).not.toHaveBeenCalled();
    expect(run.tool).toHaveBeenCalledWith("page");
  });

  it("Shift+Delete (⇧⌫) clears everything with any tool, and is kept from the page", () => {
    const run = actions(false);
    const e = new KeyboardEvent("keydown", { key: "Backspace", shiftKey: true, cancelable: true });
    keyHandler(() => "comment", run).keydown(e);
    expect(e.defaultPrevented).toBe(true);
    expect(run.clear).toHaveBeenCalledOnce();
    expect(run.remove).not.toHaveBeenCalled();
  });

  it("I flips the output switch", () => {
    const run = actions(false);
    press(keyHandler(() => "pen", run).keydown, "i");
    expect(run.image).toHaveBeenCalledOnce();
  });
});
