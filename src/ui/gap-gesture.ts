// The Gap tool's gesture: a drag from one element to another (or from an element to its
// container) snaps to their facing edges and measures the space between in CSS pixels; its note
// takes "smaller", "bigger" or a target. A numbered mark like a pick: [n] gap: 24px between …

import { measureGap, midpoint, shiftLine } from "../draw/gap";
import type { GapLine, Pin } from "../marks/types";
import { viewRect } from "../pick/describe";
import { elementAt } from "../pick/walk";
import { pageToClient, scroll, toView } from "../screen/surface";
import type { Point } from "../shared/geometry";
import { openBubble } from "./bubble";
import type { State } from "./state";

export type GapHost = {
  state: State;
  root: ShadowRoot;
  host: HTMLElement;
  update: (change: () => void) => void;
  say: (message: string, kind?: "ok" | "error") => void;
  drag: (down: PointerEvent, move: (p: Point, shift: boolean) => void, end: () => void) => void;
};

/** The badge sits beside the measure's label: under a line across, left of a line down. */
export function gapBadge(line: GapLine): Point {
  const mid = midpoint(line);
  return line.axis === "x" ? { x: mid.x, y: mid.y + 18 } : { x: mid.x - 18, y: mid.y };
}

export function gapGesture(h: GapHost) {
  const { state, update } = h;

  async function askNote(pin: Pin) {
    const note = await openBubble(h.root, {
      at: pageToClient(pin.at),
      placeholder: "Smaller, bigger, or the gap you want (optional)",
      hint: "Enter saves · Esc keeps the gap without a note",
    });
    if (note) update(() => (pin.note = note));
  }

  function startGap(e: PointerEvent, page: Point) {
    const startView = toView(page);
    const a = elementAt(startView.x, startView.y, h.host);
    // The drag shows as a thin arrow until it lands; the measure replaces it.
    state.draft = { kind: "arrow", color: state.color, from: page, to: page };
    h.drag(
      e,
      (p) =>
        update(() => {
          if (state.draft?.kind === "arrow") state.draft = { ...state.draft, to: p };
        }),
      () => {
        const to = state.draft?.kind === "arrow" ? state.draft.to : page;
        update(() => (state.draft = null));
        const endView = toView(to);
        const b = elementAt(endView.x, endView.y, h.host);
        if (!a || !b) return h.say("Gap: start and end the drag on elements of the page.", "error");
        const answer = measureGap(viewRect(a), viewRect(b), startView, endView);
        if (answer.kind === "none") return h.say(`Gap: ${answer.why}.`, "error");
        const s = scroll();
        const line = shiftLine(answer.line, s.x, s.y);
        const pin: Pin = { kind: "gap", color: state.color, el: a, other: b, line, at: gapBadge(line), note: "" };
        update(() => state.marks.push(pin));
        void askNote(pin);
      },
    );
  }

  return { startGap };
}
