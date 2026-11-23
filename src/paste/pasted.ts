// Pasted images on the page (Edvard, 2026-11-18: "sometimes I screenshot and paste from buffer
// and I want to be able to move it around and it must get attached to the same page"). Ctrl+V
// drops the image at the mouse; it scrolls with the page; drag moves, the corner resizes, [ ]
// make it see-through. It is drawn into Copy's picture (picture.ts) and is kept
// through a reload with the other marks (keep/). A paste switches to Move (state.ts afterPaste).

import { type Mark, type Pasted, isPasted } from "../marks/types";
import { pageAt, scroll, toView, viewport } from "../screen/surface";
import type { Point } from "../shared/geometry";
import { drag } from "../ui/drag";
import { isEditable } from "../ui/keyboard";
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
  /** Cmd/Ctrl+V outside any field: steer the coming paste into Pointer's hidden field. */
  catchPaste: () => void;
  /** The bar's upload button: a file picker, the images land in the middle of the view. */
  upload: () => void;
  /** A press on a pasted image: moves or resizes it. False when the press is not on one. */
  onDown: (e: PointerEvent) => boolean;
  track: (e: PointerEvent) => void;
  /** The pasted image under the mouse, the topmost. */
  hovered: () => Pasted | undefined;
  see: (p: Pasted, direction: -1 | 1) => void;
};

export function createPastedLayer(host: PasteHost): PastedLayer {
  const el = Object.assign(document.createElement("div"), { className: "pasted" });
  const boxes = new Map<Pasted, HTMLElement>();
  /** The mouse on the tab (client coordinates), mapped onto the marked page where it is used. */
  let mouse = { clientX: innerWidth / 2, clientY: innerHeight / 2 };
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
      const at = toView(p.rect);
      box.style.cssText = `left:${at.x}px;top:${at.y}px;width:${p.rect.w}px;height:${p.rect.h}px;opacity:${p.opacity}`;
      if (box.parentNode !== el) el.append(box);
    }
  }

  /** An image file onto the page, centred on `at` (page coordinates). */
  async function addFile(file: File, at: Point): Promise<boolean> {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.draggable = false;
    try {
      await img.decode();
    } catch {
      URL.revokeObjectURL(img.src);
      host.say(`${file.name || "That image"} could not be read.`, "error");
      return false;
    }
    const natural = { w: img.naturalWidth, h: img.naturalHeight };
    const rect = landing(natural, devicePixelRatio, at, viewport());
    host.add({ kind: "image", img, rect, opacity: 1 });
    return true;
  }

  const HINT = "drag it, its corner resizes (Shift: free), [ ] see-through, Delete removes";

  // macOS Chrome pastes only into something editable: Cmd+V on a page with nothing focused does
  // nothing at all. So on Cmd/Ctrl+V Pointer focuses this hidden field for a moment, the paste
  // lands here, and the focus goes back (Edvard's Mac, 2026-11-18).
  const catcher = Object.assign(document.createElement("textarea"), { className: "catcher", tabIndex: -1 });
  catcher.setAttribute("aria-hidden", "true");
  el.append(catcher);
  let back: HTMLElement | null = null;
  let release = 0;
  const giveBack = () => {
    clearTimeout(release);
    catcher.value = "";
    catcher.blur();
    back?.focus({ preventScroll: true });
    back = null;
  };

  function catchPaste() {
    back = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    catcher.focus({ preventScroll: true });
    clearTimeout(release);
    release = window.setTimeout(giveBack, 400);
  }

  async function onPaste(e: ClipboardEvent) {
    const target = e.composedPath()[0] ?? null;
    if (target !== catcher && isEditable(target)) return;
    const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));
    if (target === catcher) giveBack();
    if (!file) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (await addFile(file, pageAt(mouse))) host.say(`Image pasted: ${HINT}.`);
  }

  const picker = Object.assign(document.createElement("input"), { type: "file", accept: "image/*", multiple: true, hidden: true });
  el.append(picker);
  picker.addEventListener("change", async () => {
    const files = [...(picker.files ?? [])];
    picker.value = "";
    let added = 0;
    const view = viewport();
    const s = scroll();
    for (const [i, file] of files.entries()) {
      if (await addFile(file, { x: s.x + view.w / 2 + i * 24, y: s.y + view.h / 2 + i * 24 })) added++;
    }
    if (added) host.say(`${added === 1 ? "Image" : `${added} images`} added: ${HINT}.`);
  });

  function onDown(e: PointerEvent): boolean {
    const target = e.target instanceof Element ? e.target.closest(".pimg") : null;
    const p = [...boxes].find(([, box]) => box === target)?.[0];
    if (!p) return false;
    e.preventDefault();
    const start = { ...p.rect };
    const from = pageAt(e);
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
    catchPaste,
    upload: () => picker.click(),
    onDown,
    track: (e) => {
      mouse = { clientX: e.clientX, clientY: e.clientY };
    },
    hovered: () => {
      const at = pageAt(mouse);
      return all().findLast((p) => gripAt(p.rect, at) !== null);
    },
    see: (p, direction) => host.update(() => (p.opacity = stepOpacity(p.opacity, direction))),
  };
}
