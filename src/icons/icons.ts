// Icons laid on the page (Edvard, 2026-11-19, his pick: "Lucide, bundled"): the bar's icon button
// opens the picker; an icon lands centred on the drop point or the last point (else the middle of
// the view), snapped to the element under it like a pick, and numbered: "[6] icon: lucide
// calendar-heart on EventCard (EventCard.tsx:27)". It moves by a drag, resizes from its
// bottom-right corner, and Delete removes it, like the other marks.

import type { Pin } from "../marks/types";
import { elementAt } from "../pick/walk";
import type { Point } from "../shared/geometry";
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
  /** The last point the mouse was on the page (page coordinates), or null before any. */
  last: () => Point | null;
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

  function place(name: string, svg: string, view: Point | null) {
    const point = view ? { x: view.x + scrollX, y: view.y + scrollY } : h.last();
    const at = placeAt(SIZE, point, { w: innerWidth, h: innerHeight }, { x: scrollX, y: scrollY });
    const icon: IconMark = { kind: "icon", color: h.state.color, el: under(at, SIZE), at, note: "", name, svg, size: SIZE };
    h.update(() => h.state.marks.push(icon));
    h.say(`Icon ${name} added: drag it, its corner resizes, Delete removes.`);
  }

  const picker = createIconPicker({ place, say: h.say });

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

  return { el: picker.el, toggle: picker.toggle, grab };
}
