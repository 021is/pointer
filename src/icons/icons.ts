// Icons laid on the page (Edvard, 2026-11-19, his pick: "Lucide, bundled"). The Icon tool: click
// a spot, the picker opens there (picker.ts), and the icon chosen lands centred on that spot
// (Edvard, 2026-11-23), snapped to the element under it like a pick, and numbered: "[6] icon:
// lucide calendar-heart on EventCard (EventCard.tsx:27)". It moves by a drag (from anywhere on
// it, its number too), resizes from its bottom-right corner, and Delete removes it, like the other
// marks.

import type { Pin } from "../marks/types";
import { elementAt } from "../pick/walk";
import type { Point } from "../shared/geometry";
import { isTouch } from "../shared/platform";
import type { State } from "../ui/state";
import { createIconPicker } from "./picker";
import { placeAt } from "./search";

export type IconMark = Extract<Pin, { kind: "icon" }>;

export type IconsHost = {
  state: State;
  host: HTMLElement;
  update: (change: () => void) => void;
  drag: (down: PointerEvent, move: (p: Point, shift: boolean) => void, end: () => void) => void;
  say: (message: string, kind?: "ok" | "error") => void;
};

const SIZE = 32;
const GRIP = 8;

/** The topmost icon under a page point. */
export function iconAt(marks: State["marks"], p: Point): IconMark | undefined {
  return marks.findLast(
    (m): m is IconMark => m.kind === "icon" && p.x >= m.at.x && p.x <= m.at.x + m.size && p.y >= m.at.y && p.y <= m.at.y + m.size,
  );
}

/** A drag on an icon: its bottom-right corner resizes it (square, 12 px at least), the rest moves it. */
export function dragged(start: { at: Point; size: number }, from: Point, to: Point): { at: Point; size: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const corner = from.x >= start.at.x + start.size - GRIP && from.y >= start.at.y + start.size - GRIP;
  if (corner) return { at: start.at, size: Math.max(12, Math.round(start.size + Math.max(dx, dy))) };
  return { at: { x: start.at.x + dx, y: start.at.y + dy }, size: start.size };
}

export function createIcons(h: IconsHost) {
  /** The element under an icon's middle, else the page: what the icon is "on". */
  const under = (at: Point, size: number) =>
    elementAt(at.x + size / 2 - scrollX, at.y + size / 2 - scrollY, h.host) ?? document.body;

  /** The icon chosen, centred on the spot that was clicked (page coordinates). */
  function place(name: string, svg: string, page: Point) {
    const at = placeAt(SIZE, page);
    const icon: IconMark = { kind: "icon", color: h.state.color, el: under(at, SIZE), at, note: "", name, svg, size: SIZE };
    h.update(() => h.state.marks.push(icon));
    const gone = isTouch() ? "Undo takes it back" : "Delete removes it";
    h.say(`Icon ${name} added: drag it to move it, its corner resizes it, ${gone}.`);
  }

  const picker = createIconPicker({ place, say: h.say });

  /** The Icon tool's click: the picker opens beside it (`view`), and places on it (`page`). */
  const ask = (view: Point, page: Point) => picker.open(view, page);

  /** A press on an icon grabs it; false when the press is not on one. */
  function grab(e: PointerEvent, page: Point): boolean {
    const icon = iconAt(h.state.marks, page);
    if (!icon) return false;
    const start = { at: { ...icon.at }, size: icon.size };
    h.drag(
      e,
      (p) => h.update(() => Object.assign(icon, dragged(start, page, p))),
      () => h.update(() => (icon.el = under(icon.at, icon.size))),
    );
    return true;
  }

  /** An icon moved by its number: it is now on the element under its new middle. */
  function settle(pin: Pin) {
    if (pin.kind === "icon") h.update(() => (pin.el = under(pin.at, pin.size)));
  }

  return { el: picker.el, ask, close: picker.close, grab, settle };
}
