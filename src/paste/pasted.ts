// Pasted images on the page (Edvard, 2026-11-18: "sometimes I screenshot and paste from buffer
// and I want to be able to move it around and it must get attached to the same page"). Ctrl+V
// drops the image at the mouse; it scrolls with the page; drag moves, the corner resizes, [ ]
// make it see-through. It is drawn into Copy's picture (picture.ts) and lives until reload.

import { type Mark, type Pasted, isPasted } from "../marks/types";
import type { Point } from "../shared/geometry";
import { drag } from "../ui/drag";
import { type Grip, dragged, gripAt, landing, stepOpacity } from "./geometry";

export type PasteHost = {
  marks: () => readonly Mark[];
  add: (p: Pasted) => void;
  update: (change: () => void) => void;
  say: (message: string, kind?: "ok" | "error") => void;
};

export type PastedLayer = {
  el: HTMLElement;
  paint: () => void;
  onPaste: (e: ClipboardEvent) => void;
  /** A press on a pasted image: moves or resizes it. False when the press is not on one. */
  onDown: (e: PointerEvent) => boolean;
  track: (e: PointerEvent) => void;
  /** The pasted image under the mouse, the topmost. */
  hovered: () => Pasted | undefined;
  see: (p: Pasted, direction: -1 | 1) => void;
};

const isEditable = (t: EventTarget | null) =>
  t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || (t instanceof HTMLElement && t.isContentEditable);

export function createPastedLayer(host: PasteHost): PastedLayer {
  const el = Object.assign(document.createElement("div"), { className: "pasted" });
  const boxes = new Map<Pasted, HTMLElement>();
  let mouse: Point = { x: innerWidth / 2, y: innerHeight / 2 };
  const all = () => host.marks().filter(isPasted);

  function boxOf(p: Pasted): HTMLElement {
    let box = boxes.get(p);
    if (!box) {
      box = Object.assign(document.createElement("div"), { className: "pimg" });
      box.append(p.img, Object.assign(document.createElement("span"), { className: "grip" }));
      boxes.set(p, box);
    }
    return box;
  }

  function paint() {
    const live = all();
    for (const [p, box] of boxes) {
      if (live.includes(p)) continue;
      box.remove();
      boxes.delete(p);
      URL.revokeObjectURL(p.img.src);
    }
    for (const p of live) {
      const box = boxOf(p);
      box.style.cssText = `left:${p.rect.x - scrollX}px;top:${p.rect.y - scrollY}px;width:${p.rect.w}px;height:${p.rect.h}px;opacity:${p.opacity}`;
      if (box.parentNode !== el) el.append(box);
    }
  }

  async function onPaste(e: ClipboardEvent) {
    if (isEditable(e.composedPath()[0] ?? null)) return;
    const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));
    if (!file) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.draggable = false;
    try {
      await img.decode();
    } catch {
      URL.revokeObjectURL(img.src);
      return host.say("That image could not be read.", "error");
    }
    const at = { x: mouse.x + scrollX, y: mouse.y + scrollY };
    const natural = { w: img.naturalWidth, h: img.naturalHeight };
    const rect = landing(natural, devicePixelRatio, at, { w: innerWidth, h: innerHeight });
    host.add({ kind: "image", img, rect, opacity: 1 });
    host.say("Image pasted: drag it, its corner resizes (Shift: free), [ ] see-through, Del removes.");
  }

  function onDown(e: PointerEvent): boolean {
    const target = e.target instanceof Element ? e.target.closest(".pimg") : null;
    const p = [...boxes].find(([, box]) => box === target)?.[0];
    if (!p) return false;
    e.preventDefault();
    const start = { ...p.rect };
    const from = { x: e.clientX + scrollX, y: e.clientY + scrollY };
    const grip: Grip = gripAt(start, from) ?? "move";
    const layer = target?.closest(".layer");
    if (!(layer instanceof HTMLElement)) return false;
    drag(
      layer,
      e,
      (to, shift) => host.update(() => (p.rect = dragged(start, grip, to.x - from.x, to.y - from.y, shift))),
      () => {},
    );
    return true;
  }

  return {
    el,
    paint,
    onPaste: (e) => void onPaste(e),
    onDown,
    track: (e) => {
      mouse = { x: e.clientX, y: e.clientY };
    },
    hovered: () => {
      const at = { x: mouse.x + scrollX, y: mouse.y + scrollY };
      return all().findLast((p) => gripAt(p.rect, at) !== null);
    },
    see: (p, direction) => host.update(() => (p.opacity = stepOpacity(p.opacity, direction))),
  };
}
