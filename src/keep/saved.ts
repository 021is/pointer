// Marks as plain data, so they outlive a reload of the page (Edvard, 2026-11-19: "I was working
// and commenting and then reload happen"). An element becomes the selector that finds it again; a
// pasted image becomes its data URL. Pure: the page comes in as functions.

import type { GapLine, Mark, Pasted, Pin, PointKind, Shape } from "../marks/types";
import type { ElementEdits } from "../panel/edits";
import type { Point, Rect } from "../shared/geometry";
import { isSavedMark } from "./check";

/** How an element is found again after a reload: its selector, checked against its tag. */
export type Target = { selector: string; tag: string; label: string };

export type SavedMark =
  | { kind: "shape"; shape: Shape }
  | { kind: "pin"; pin: PointKind; color: Pin["color"]; at: Point; note: string; target: Target; edits: ElementEdits | null }
  | { kind: "gap"; color: Pin["color"]; at: Point; note: string; target: Target; other: Target; line: GapLine }
  /** An icon by its Lucide name only: its drawing comes from the bundled data when it returns. */
  | { kind: "icon"; color: Pin["color"]; at: Point; note: string; target: Target; name: string; size: number }
  | { kind: "crop"; target: Target | null; rect: Rect }
  | { kind: "image"; src: string; rect: Rect; opacity: number };

export type Saved = { v: 1; marks: SavedMark[] };

/** The page as saving sees it. `imageSrc` is null while an image's data URL is still being read. */
export type SaveWorld = {
  target: (el: Element) => Target;
  editsOf: (pin: Pin) => ElementEdits | null;
  imageSrc: (p: Pasted) => string | null;
};

/** One page, whatever its query or hash: a reload with ?x=1 is the same page. */
export function pageKey(url: string): string {
  const u = new URL(url);
  return `${u.origin}${u.pathname}`;
}

/** The marks as data. An image whose data URL is still being read waits for the next save. */
export function toSaved(marks: readonly Mark[], w: SaveWorld): Saved {
  const out: SavedMark[] = [];
  for (const m of marks) {
    switch (m.kind) {
      case "pen":
      case "arrow":
      case "box":
      case "ellipse":
      case "text":
        out.push({ kind: "shape", shape: m });
        break;
      case "pick":
      case "comment":
      case "idea":
        out.push({ kind: "pin", pin: m.kind, color: m.color, at: m.at, note: m.note, target: w.target(m.el), edits: w.editsOf(m) });
        break;
      case "gap":
        out.push({ kind: "gap", color: m.color, at: m.at, note: m.note, target: w.target(m.el), other: w.target(m.other), line: m.line });
        break;
      case "icon":
        out.push({ kind: "icon", color: m.color, at: m.at, note: m.note, target: w.target(m.el), name: m.name, size: m.size });
        break;
      case "crop":
        out.push({ kind: "crop", target: m.el ? w.target(m.el) : null, rect: m.rect });
        break;
      case "image": {
        const src = w.imageSrc(m);
        if (src) out.push({ kind: "image", src, rect: m.rect, opacity: m.opacity });
        break;
      }
    }
  }
  return { v: 1, marks: out };
}

/** What the session store counts: the JSON's UTF-8 bytes. */
export const savedBytes = (saved: Saved) => new TextEncoder().encode(JSON.stringify(saved)).length;

/**
 * Within the session store's room: when the whole is over `budget` bytes, the pasted images go
 * first (the marks and words are what matter), and the answer says how many went.
 */
export function fitBudget(saved: Saved, budget: number): { saved: Saved; dropped: number } {
  if (savedBytes(saved) <= budget) return { saved, dropped: 0 };
  const marks = saved.marks.filter((m) => m.kind !== "image");
  return { saved: { v: 1, marks }, dropped: saved.marks.length - marks.length };
}

/** The page as restoring sees it. */
export type RestoreWorld = {
  find: (t: Target) => Element | null;
  /** The element at a page point, for a comment whose own element is gone. */
  at: (p: Point) => Element | null;
  image: (src: string) => HTMLImageElement;
  /** An icon's markup from the bundled Lucide data, by name; null when this build has no such icon. */
  iconSvg: (name: string) => string | null;
  /** The page itself, for a mark with nothing else under it. */
  page: Element;
};

export type Restored = {
  marks: Mark[];
  /** Picks whose CSS edits are put back on their element. */
  replay: { pin: Pin; edits: ElementEdits }[];
  /** What could not be found again, said to the person ("pick button.cta"). */
  lost: string[];
};

export function fromSaved(saved: Saved, w: RestoreWorld): Restored {
  const out: Restored = { marks: [], replay: [], lost: [] };
  for (const m of saved.marks as readonly unknown[]) {
    // A mark this version cannot read (another version's kind, a damaged entry) is named, not dropped.
    if (!isSavedMark(m)) {
      out.lost.push("a mark this version of Pointer cannot read");
      continue;
    }
    switch (m.kind) {
      case "shape":
        out.marks.push(m.shape);
        break;
      case "pin": {
        // A comment or an idea marks a point: when its element is gone, the element now there.
        const el = w.find(m.target) ?? (m.pin === "pick" ? null : w.at(m.at));
        if (!el) {
          out.lost.push(`${m.pin} ${m.target.label}`);
          break;
        }
        const pin: Pin = { kind: m.pin, color: m.color, el, at: m.at, note: m.note };
        out.marks.push(pin);
        if (m.edits) out.replay.push({ pin, edits: m.edits });
        break;
      }
      case "gap": {
        const el = w.find(m.target);
        const other = w.find(m.other);
        if (!el || !other) {
          out.lost.push(`gap ${m.target.label} – ${m.other.label}`);
          break;
        }
        out.marks.push({ kind: "gap", color: m.color, el, other, at: m.at, note: m.note, line: m.line });
        break;
      }
      case "icon": {
        // Drawn from the bundled Lucide data by its name; a name this build lacks is named as lost.
        const svg = w.iconSvg(m.name);
        if (svg === null) {
          out.lost.push(`icon ${m.name}`);
          break;
        }
        // An icon lies on the page whatever is under it: the element now there, else the page.
        const el = w.find(m.target) ?? w.at({ x: m.at.x + m.size / 2, y: m.at.y + m.size / 2 }) ?? w.page;
        out.marks.push({ kind: "icon", color: m.color, el, at: m.at, note: m.note, name: m.name, svg, size: m.size });
        break;
      }
      case "crop":
        // A component's frame without its component keeps the rectangle it last had.
        out.marks.push({ kind: "crop", el: m.target ? w.find(m.target) : null, rect: m.rect });
        break;
      case "image":
        out.marks.push({ kind: "image", img: w.image(m.src), rect: m.rect, opacity: m.opacity });
        break;
    }
  }
  return out;
}

/** What the person reads once the marks are back, lost ones named (never dropped silently). */
export function restoredMessage(r: Restored): string {
  const n = r.marks.length;
  const back = n ? `${n === 1 ? "1 mark is" : `${n} marks are`} back from before the reload.` : "";
  const lost = r.lost.length ? ` Not on the page any more: ${r.lost.join(", ")}.` : "";
  return (back + lost).trim();
}

