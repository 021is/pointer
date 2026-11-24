// The bar on a narrow viewport (Edvard, 2026-11-23: "change the bar to become shorter in mobile
// screen when inspect is open"): below 768 px (a phone or a small tablet in Chrome DevTools'
// device mode, a narrow window) it docks to the bottom edge, centred and as wide as its tools,
// each named under its icon: as many as the width has room for (fit.ts), and More. More opens the
// tool sheet (sheet.ts, Edvard 2026-11-24) with the rest, just above the bar, the page still seen
// above it. While it is open More says Close; choosing a tool closes it, and so do Esc, a press
// outside the bar (that press does nothing else) and a drag down. Undo, Redo, Clear, the colours
// and Picture | Text keep it open: their effect shows on the page above. On a wide viewport the
// More button is hidden and the bar is as it always was. The layout is CSS (narrow-css.ts).

import { closeOnOutside } from "../shared/outside";
import { icon } from "./icons";

/** Where the bar turns narrow: the CSS (narrow-css.ts) and the bar's arrangement (toolbar.ts). */
export const NARROW = "(max-width: 767px)";

/** A button's short name, shown under its icon on the narrow bar and in the draw menu: its tip's
 *  first word ("Gap: drag from…" → "Gap"), or the word a person would look for where that word
 *  says little. */
const NAMES: readonly [prefix: string, name: string][] = [
  ["Use the page", "Page"],
  ["Add an image", "Image"],
  ["Close Pointer", "Exit"],
  ["More drawing tools", "Shapes"],
  ["Choose what Copy gives", "Options"],
];

export function buttonName(text: string): string {
  return NAMES.find(([prefix]) => text.startsWith(prefix))?.[1] ?? text.split(/[\s:·(]/)[0] ?? text;
}

/** Marks the controls whose effect shows on the page: pressed in the open sheet, it stays open. */
export function staysOpen(...els: Element[]): void {
  for (const el of els) el.setAttribute("data-stay", "");
}

/** How far down a drag must take the sheet to close it, in px; a shorter one springs back. */
export const DRAG_CLOSE = 48;
export const closesOnRelease = (dy: number) => dy >= DRAG_CLOSE;

export type Compact = { toggle: HTMLButtonElement; collapse: () => boolean };

type Tip = (b: HTMLElement, text: string, key: string) => void;

export function createCompact(bar: HTMLElement, sheet: HTMLElement, tip: Tip): Compact {
  const toggle = Object.assign(document.createElement("button"), { type: "button", className: "more-toggle" });
  toggle.setAttribute("aria-controls", sheet.id);
  /** More, or Close while the sheet is open: its icon, its name and its accessible name follow. */
  const show = (open: boolean) => {
    toggle.replaceChildren(icon(open ? "down" : "more"));
    tip(toggle, open ? "Close the tools" : "More tools", "");
    toggle.setAttribute("aria-expanded", String(open));
  };
  show(false);

  const isOpen = () => bar.dataset.more === "open";
  /** A press outside the bar while the sheet is open only closes it. */
  const outside = closeOnOutside(bar, () => collapse());
  function open() {
    bar.dataset.more = "open";
    show(true);
    outside.watch();
  }
  /** Closes the sheet; true when it was open (Esc then does nothing else). */
  function collapse(): boolean {
    if (!isOpen()) return false;
    delete bar.dataset.more;
    show(false);
    outside.unwatch();
    return true;
  }
  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!collapse()) open();
  });
  // A tool chosen in the sheet closes it: the page is visible again at once.
  bar.addEventListener(
    "click",
    (e) => {
      const b = (e.target as Element | null)?.closest?.("button");
      if (b && b !== toggle && !b.closest("[data-stay]") && isOpen()) collapse();
    },
    true,
  );
  dragDown(bar, sheet, isOpen, collapse);
  return { toggle, collapse };
}

/** A drag down from anywhere on the open sheet but a button: the sheet follows the finger
 *  (--drag, narrow-css.ts) and closes past DRAG_CLOSE, else springs back. */
function dragDown(bar: HTMLElement, sheet: HTMLElement, isOpen: () => boolean, collapse: () => boolean): void {
  sheet.addEventListener("pointerdown", (down) => {
    if (!isOpen() || (down.target as Element | null)?.closest?.("button")) return;
    let dy = 0;
    bar.dataset.dragging = "";
    const move = (e: PointerEvent) => {
      dy = Math.max(0, e.clientY - down.clientY);
      bar.style.setProperty("--drag", `${dy}px`);
    };
    // A cancelled drag (the browser took the gesture) springs back; only a release closes.
    const cancel = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", cancel);
      delete bar.dataset.dragging;
      bar.style.removeProperty("--drag");
    };
    const release = () => {
      cancel();
      if (closesOnRelease(dy)) collapse();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", cancel);
  });
}
