// @vitest-environment happy-dom
// The icon picker's gestures on its real DOM: a press without a move adds the icon at the last
// point (null), a drag let go outside the panel drops it there; Lucide's data is already loaded.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createIconPicker } from "../src/icons/picker";

afterEach(() => {
  globalThis.__pointerLucide = undefined;
  document.body.innerHTML = "";
});

async function open() {
  globalThis.__pointerLucide = { version: "0.503.0", svg: { bell: "<path/>", "bell-ring": "<path/>" }, tags: { bell: [], "bell-ring": [] } };
  const place = vi.fn();
  const picker = createIconPicker({ place, say: () => {} });
  document.body.append(picker.el);
  picker.toggle();
  await new Promise((r) => setTimeout(r, 0));
  const result = picker.el.querySelector<HTMLButtonElement>(".icon-result") as HTMLButtonElement;
  result.setPointerCapture = () => {};
  return { place, result };
}

const pointer = (type: string, x: number, y: number) => new PointerEvent(type, { clientX: x, clientY: y, bubbles: true, pointerId: 1 });

describe("placing an icon", () => {
  it("by click: at the last point", async () => {
    const { place, result } = await open();
    result.dispatchEvent(pointer("pointerdown", 10, 10));
    result.dispatchEvent(pointer("pointerup", 10, 10));
    expect(place).toHaveBeenCalledWith("bell", "<path/>", null);
  });

  it("by drop: where it was let go, outside the panel", async () => {
    const { place, result } = await open();
    result.dispatchEvent(pointer("pointerdown", 10, 10));
    result.dispatchEvent(pointer("pointermove", 200, 300));
    result.dispatchEvent(pointer("pointerup", 640, 420));
    expect(place).toHaveBeenCalledWith("bell", "<path/>", { x: 640, y: 420 });
  });
});
