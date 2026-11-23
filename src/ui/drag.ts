// One pointer drag on Pointer's layer: moves in page coordinates (with Shift), then its end. The
// page is the one being marked: the tab's, or its copy framed at a screen size.

import { pageAt } from "../screen/surface";
import type { Point } from "../shared/geometry";

export function drag(
  layer: HTMLElement,
  down: PointerEvent,
  move: (p: Point, shift: boolean) => void,
  end: () => void,
): void {
  layer.setPointerCapture(down.pointerId);
  const onMove = (e: PointerEvent) => move(pageAt(e), e.shiftKey);
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
