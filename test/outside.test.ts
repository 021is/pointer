// @vitest-environment happy-dom
// One way a menu, the icon picker or the narrow bar's More closes on a press outside it: that
// press only closes (it never also comments or draws), a press inside does nothing, and nothing
// listens once it is closed.
import { afterEach, describe, expect, it, vi } from "vitest";
import { closeOnOutside } from "../src/shared/outside";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("closeOnOutside", () => {
  it("a press outside closes and goes no further; a press inside does nothing; unwatched, nothing", () => {
    document.body.innerHTML = `<div id="menu"><button id="in">in</button></div><main id="page"></main>`;
    const menu = document.getElementById("menu") as HTMLElement;
    const page = document.getElementById("page") as HTMLElement;
    const close = vi.fn();
    const pageHeard = vi.fn();
    page.addEventListener("pointerdown", pageHeard);
    const outside = closeOnOutside(menu, close);
    outside.watch();

    document.getElementById("in")?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
    expect(close).not.toHaveBeenCalled();

    const press = new PointerEvent("pointerdown", { bubbles: true, cancelable: true });
    page.dispatchEvent(press);
    expect(close).toHaveBeenCalledTimes(1);
    expect(press.defaultPrevented).toBe(true);
    expect(pageHeard).not.toHaveBeenCalled();

    outside.unwatch();
    page.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
    expect(close).toHaveBeenCalledTimes(1);
    expect(pageHeard).toHaveBeenCalledTimes(1);
  });
});
