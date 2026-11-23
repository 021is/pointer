// What a press grabs before any tool acts: a pin's number, or a text drawn on the page. A click
// edits (a note, the text), a drag past 4 px moves (a comment, a text; a pick follows its
// element). Edvard, 2026-11-18: "I cant move text".

import { type Mark, type Pin, type Shape, isShape } from "../marks/types";
import { type Point, near } from "../shared/geometry";
import { markAt, shifted } from "./move";
import { type State, moveShape, shapeBox } from "./state";

type TextShape = Extract<Shape, { kind: "text" }>;

export type HandleHost = {
  state: State;
  update: (change: () => void) => void;
  drag: (down: PointerEvent, move: (p: Point, shift: boolean) => void, end: () => void) => void;
  editNote: (pin: Pin, view: Point) => void;
  editText: (text: TextShape, view: Point) => void;
  onPick: (pin: Pin) => void;
  /** A pin dragged by its number, let go: an icon finds the element it now lies on. */
  moved: (pin: Pin) => void;
};

/** The topmost text drawn under a page point. */
export function textAt(marks: State["marks"], page: Point): TextShape | undefined {
  return marks.filter(isShape).findLast((s): s is TextShape => {
    if (s.kind !== "text") return false;
    const b = shapeBox(s);
    return page.x >= b.x - 4 && page.x <= b.x + b.w + 4 && page.y >= b.y - 4 && page.y <= b.y + b.h + 4;
  });
}

export function handles(host: HandleHost) {
  /** Press, then: moved past 4 px → `move` from the press (and `done` once let go), else `click`. */
  function press(e: PointerEvent, page: Point, move: ((dx: number, dy: number) => void) | null, click: () => void, done = () => {}) {
    let moved = false;
    host.drag(
      e,
      (p) => {
        if (!move || (!moved && near(p, page, 4))) return;
        moved = true;
        host.update(() => move(p.x - page.x, p.y - page.y));
      },
      () => (moved ? done() : click()),
    );
  }

  function grabPin(e: PointerEvent, pin: Pin, view: Point, page: Point) {
    const start = { ...pin.at };
    // A comment's, an idea's and an icon's badge drag (an icon's sits on its corner: a press there
    // opened the note and never moved it); a pick's follows its element, a gap's its measure.
    const free = pin.kind === "comment" || pin.kind === "idea" || pin.kind === "icon";
    const move = free ? (dx: number, dy: number) => (pin.at = { x: start.x + dx, y: start.y + dy }) : null;
    press(
      e,
      page,
      move,
      () => {
        if (pin.kind === "pick") host.onPick(pin);
        host.editNote(pin, view);
      },
      () => host.moved(pin),
    );
  }

  function grabText(e: PointerEvent, text: TextShape, view: Point, page: Point) {
    const start = { ...text.at };
    press(
      e,
      page,
      (dx, dy) => {
        const moved = moveShape({ ...text, at: start }, dx, dy);
        if (moved.kind === "text") text.at = moved.at;
      },
      () => host.editText(text, view),
    );
  }

  /** Move tool: drag the mark under the pointer (a drawing, a text, a free crop frame). */
  function grabMark(e: PointerEvent, page: Point) {
    const { state } = host;
    const start = markAt(state.marks, page);
    if (!start) return;
    // Followed by identity: an Undo or Delete during the drag can never make it move another mark.
    let current: Mark = start;
    host.drag(
      e,
      (p) => {
        const index = state.marks.indexOf(current);
        if (index < 0) return;
        const next = shifted(start, p.x - page.x, p.y - page.y);
        host.update(() => (state.marks[index] = next));
        current = next;
      },
      () => host.update(() => {}),
    );
  }

  return { grabPin, grabText, grabMark };
}
