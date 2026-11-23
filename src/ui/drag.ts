// One pointer drag on Pointer's layer: moves in page coordinates (with Shift), then its end.

import type { Point } from "../shared/geometry";

export function drag(
  layer: HTMLElement,
  down: PointerEvent,
  move: (p: Point, shift: boolean) => void,
  end: () => void,
): void {
  layer.setPointerCapture(down.pointerId);
  const onMove = (e: PointerEvent) => move({ x: e.clientX + scrollX, y: e.clientY + scrollY }, e.shiftKey);
  const onUp = () => {
    layer.removeEventListener("pointermove", onMove);
    layer.removeEventListener("pointerup", onUp);
    layer.removeEventListener("pointercancel", onUp);
    end();
  };
  layer.addEventListener("pointermove", onMove);
  layer.addEventListener("pointerup", onUp);
  layer.addEventListener("pointercancel", onUp);
}
