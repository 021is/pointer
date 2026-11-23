// The crop tool's gestures: a click takes the component under the cursor (its box, followed
// live), a drag draws a free frame. Frames under 8 px each way are refused, said so.

import { viewRect } from "../pick/describe";
import { scroll } from "../screen/surface";
import { type Point, dragRect, near } from "../shared/geometry";
import type { State } from "./state";

export type CropHost = {
  state: State;
  update: (change: () => void) => void;
  render: () => void;
  say: (message: string, kind?: "ok" | "error") => void;
  drag: (down: PointerEvent, move: (p: Point, shift: boolean) => void, end: () => void) => void;
};

export function cropGestures(host: CropHost) {
  const { state, update } = host;

  /** A crop of the component's box (followed live), its page rect kept for when it leaves. */
  function cropElement(el: Element) {
    const r = viewRect(el);
    const s = scroll();
    update(() => state.marks.push({ kind: "crop", el, rect: { ...r, x: r.x + s.x, y: r.y + s.y } }));
  }

  function startCrop(e: PointerEvent, page: Point, under: Element | null) {
    let moved = false;
    const move = (p: Point) => {
      if (!moved && near(p, page, 4)) return;
      moved = true;
      update(() => (state.framing = dragRect(page, p, false)));
    };
    host.drag(e, move, () => {
      const f = state.framing;
      state.framing = null;
      if (!moved) return under ? cropElement(under) : host.render();
      if (f && f.w >= 8 && f.h >= 8) state.marks.push({ kind: "crop", el: null, rect: f });
      else host.say("That frame is too small: drag at least 8 px each way.", "error");
      host.render();
    });
  }

  return { cropElement, startCrop };
}
