// Marks as plain data, so they outlive a reload of the page (Edvard, 2026-11-19: "I was working
// and commenting and then reload happen"). An element becomes the selector that finds it again; a
// pasted image becomes its data URL. Pure: the page comes in as functions.

import type { Mark, Pasted, Pin, Shape } from "../marks/types";
import type { ElementEdits } from "../panel/edits";
import type { Point, Rect } from "../shared/geometry";

/** How an element is found again after a reload: its selector, checked against its tag. */
export type Target = { selector: string; tag: string; label: string };

export type SavedMark =
  | { kind: "shape"; shape: Shape }
  | { kind: "pin"; pin: Pin["kind"]; color: Pin["color"]; at: Point; note: string; target: Target; edits: ElementEdits | null }
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

/** The marks as data. `pending` counts the images not saved yet (their data URL is not read). */
export function toSaved(marks: readonly Mark[], w: SaveWorld): { saved: Saved; pending: number } {
  let pending = 0;
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
        out.push({ kind: "pin", pin: m.kind, color: m.color, at: m.at, note: m.note, target: w.target(m.el), edits: w.editsOf(m) });
        break;
      case "crop":
        out.push({ kind: "crop", target: m.el ? w.target(m.el) : null, rect: m.rect });
        break;
      case "image": {
        const src = w.imageSrc(m);
        if (src) out.push({ kind: "image", src, rect: m.rect, opacity: m.opacity });
        else pending++;
        break;
      }
    }
  }
  return { saved: { v: 1, marks: out }, pending };
}

/**
 * Within the session store's room: when the whole is over `budget` characters, the pasted images
 * go first (the marks and words are what matter), and the answer says how many went.
 */
export function fitBudget(saved: Saved, budget: number): { saved: Saved; dropped: number } {
  if (JSON.stringify(saved).length <= budget) return { saved, dropped: 0 };
  const marks = saved.marks.filter((m) => m.kind !== "image");
  return { saved: { v: 1, marks }, dropped: saved.marks.length - marks.length };
}

/** The page as restoring sees it. */
export type RestoreWorld = {
  find: (t: Target) => Element | null;
  /** The element at a page point, for a comment whose own element is gone. */
  at: (p: Point) => Element | null;
  image: (src: string) => HTMLImageElement;
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
  for (const m of saved.marks) {
    switch (m.kind) {
      case "shape":
        out.marks.push(m.shape);
        break;
      case "pin": {
        // A comment marks a point: when its element is gone, the element now at that point.
        const el = w.find(m.target) ?? (m.pin === "comment" ? w.at(m.at) : null);
        if (!el) {
          out.lost.push(`${m.pin} ${m.target.label}`);
          break;
        }
        const pin: Pin = { kind: m.pin, color: m.color, el, at: m.at, note: m.note };
        out.marks.push(pin);
        if (m.edits) out.replay.push({ pin, edits: m.edits });
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

/** Checked where it enters the service worker or comes back from the store. */
export function isSaved(value: unknown): value is Saved {
  const s = value as Partial<Saved> | null;
  return s?.v === 1 && Array.isArray(s.marks);
}
