// Crops scrolled out of view are captured anyway (Edvard, 2026-11-24, trying 1.1.0: Preview with
// every crop scrolled away said "Preview failed: every crop is scrolled out of view"). Pointer
// scrolls each crop not wholly in view into view, takes the screenshot there and puts every
// scroll back exactly where it was (shots.ts). Crops close together share one stop; far apart,
// one at a time. A crop in a scrolling box of its own (a list, a panel) is scrolled into view by
// that box. A crop larger than the screen shows its top left part, and the person is told how to
// get all of it. Pure: the plan.

import type { Point, Rect, Size } from "../shared/geometry";

/** A crop as the page lays it out now: its box in page coordinates (the scroll added), whether it
 *  sits in a scrolling box of its own, and whether that box hides part of it now. */
export type PageFrame = { label: string; rect: Rect; nested: boolean; clipped: boolean };

/** The window: its size, where it is scrolled to, and how far it can scroll. */
export type Screen = { size: Size; scroll: Point; max: Point };

/** One screenshot: the window scrolled to a point, or one nested crop's own box scrolled to it. */
export type Stop = { kind: "page"; scroll: Point; labels: string[] } | { kind: "box"; label: string; whole: boolean };

/** The stops in order (the page as it is first, when it shows any crop whole) and the crops
 *  larger than the screen, which only partly fit. */
export type Plan = { stops: Stop[]; larger: string[] };

const within = (r: Rect, at: Point, size: Size) => r.x >= at.x && r.y >= at.y && r.x + r.w <= at.x + size.w && r.y + r.h <= at.y + size.h;
const clamp = (v: number, max: number) => Math.round(Math.min(Math.max(0, v), Math.max(0, max)));
const union = (a: Rect, b: Rect): Rect => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};
const fits = (r: Rect, size: Size) => r.w <= size.w && r.h <= size.h;

/** Where the window goes for crops that fit together: centred on them; a larger crop, its top left. */
function aim(box: Rect, screen: Screen): Point {
  if (!fits(box, screen.size)) return { x: clamp(box.x, screen.max.x), y: clamp(box.y, screen.max.y) };
  return {
    x: clamp(box.x + box.w / 2 - screen.size.w / 2, screen.max.x),
    y: clamp(box.y + box.h / 2 - screen.size.h / 2, screen.max.y),
  };
}

export function planSweep(frames: readonly PageFrame[], screen: Screen): Plan {
  const now = frames.filter((f) => !f.clipped && within(f.rect, screen.scroll, screen.size));
  const stops: Stop[] = now.length ? [{ kind: "page", scroll: screen.scroll, labels: now.map((f) => f.label) }] : [];
  const rest = frames.filter((f) => !now.includes(f));
  const larger = rest.filter((f) => !fits(f.rect, screen.size)).map((f) => f.label);
  for (const f of rest.filter((r) => r.nested)) stops.push({ kind: "box", label: f.label, whole: fits(f.rect, screen.size) });

  const page = rest.filter((f) => !f.nested).sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x);
  let group: PageFrame[] = [];
  let box: Rect | null = null;
  const flush = () => {
    if (box && group.length) stops.push({ kind: "page", scroll: aim(box, screen), labels: group.map((f) => f.label) });
  };
  for (const f of page) {
    const grown: Rect = box ? union(box, f.rect) : f.rect;
    if (box && !fits(grown, screen.size)) {
      flush();
      group = [f];
      box = f.rect;
    } else {
      group.push(f);
      box = grown;
    }
  }
  flush();
  return { stops, larger };
}

const crops = (labels: readonly string[], one: string, many: string) =>
  labels.length === 1 ? `Crop ${labels[0]} ${one}` : `Crops ${labels.join(", ")} ${many}`;

/** What to tell a person when a crop is not wholly in the picture: plain, with the way to fix it,
 *  never as a failure (the picture and the text are there). Null when every crop is in whole. */
export function sweepNote(larger: readonly string[], missed: readonly string[]): string | null {
  const notes: string[] = [];
  if (larger.length) {
    notes.push(
      `${crops(larger, "is", "are")} larger than the screen, so the picture shows the top left part. To get all of it, crop a smaller part or zoom the page out (Ctrl − or ⌘ −) and copy again.`,
    );
  }
  if (missed.length) {
    const it = missed.length === 1 ? "it" : "them";
    notes.push(`${crops(missed, "was", "were")} not found on the page when copying, so the text names ${it} without a picture. Crop ${it} again if the page changed.`);
  }
  return notes.length ? notes.join(" ") : null;
}

/** How each crop's frame enters the picture, for the cost estimate: its size, at most the screen's. */
export function framedSizes(frames: readonly { label: string; rect: Rect }[], screen: Size) {
  return frames.map((f) => ({ label: f.label, rect: { x: 0, y: 0, w: Math.min(f.rect.w, screen.w), h: Math.min(f.rect.h, screen.h) } }));
}
