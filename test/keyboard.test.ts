// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { type KeyActions, keyHandler } from "../src/ui/keyboard";

const actions = (overPasted: boolean): KeyActions => ({
  tool: vi.fn(),
  color: vi.fn(),
  image: vi.fn(),
  undo: vi.fn(),
  copy: vi.fn(),
  escape: vi.fn(),
  walk: vi.fn(),
  take: vi.fn(),
  panel: vi.fn(),
  overPasted: () => overPasted,
  see: vi.fn(),
  remove: vi.fn(),
});

const press = (handler: (e: KeyboardEvent) => void, key: string) => {
  const e = new KeyboardEvent("keydown", { key, cancelable: true });
  document.body.dispatchEvent(e);
  handler(e);
  return e;
};

describe("keyHandler", () => {
  it("leaves Delete, Backspace, [ and ] to the page when no pasted image is under the mouse", () => {
    const run = actions(false);
    const handle = keyHandler(() => "pick", run);
    for (const key of ["Delete", "Backspace", "[", "]"]) expect(press(handle, key).defaultPrevented).toBe(false);
    expect(run.remove).not.toHaveBeenCalled();
    expect(run.see).not.toHaveBeenCalled();
  });

  it("takes them over a pasted image", () => {
    const run = actions(true);
    const handle = keyHandler(() => "pick", run);
    expect(press(handle, "Delete").defaultPrevented).toBe(true);
    press(handle, "[");
    expect(run.remove).toHaveBeenCalledOnce();
    expect(run.see).toHaveBeenCalledWith(-1);
  });

  it("I flips the output switch", () => {
    const run = actions(false);
    press(keyHandler(() => "pen", run), "i");
    expect(run.image).toHaveBeenCalledOnce();
  });
});
