// The bar on a narrow viewport (Edvard, 2026-11-23: "change the bar to become shorter in mobile
// screen when inspect is open"): below 768 px (a phone in Chrome DevTools' device mode, a narrow
// window) it docks to the bottom edge, full width, and keeps one row of 48 px targets: Pick,
// Comment, Draw, Undo, Copy and More. More opens every tool, named under its icon, in rows above
// that one; choosing one closes it again, and so do Esc and a press outside the bar (that press does
// nothing else). On a wide viewport the More button is hidden and the bar is as it always was.
// The layout itself is CSS (css.ts, @media (max-width: 767px)); this is its state.

import { icon } from "./icons";

/** A button's short name, shown under its icon when More is open and in the draw menu: its tip's
 *  first word ("Gap: drag from…" → "Gap"), or the word a person would look for where that word
 *  says little. */
const NAMES: readonly [prefix: string, name: string][] = [
  ["Use the page", "Page"],
  ["Add an image", "Image"],
];

export function buttonName(text: string): string {
  return NAMES.find(([prefix]) => text.startsWith(prefix))?.[1] ?? text.split(/[\s:·(]/)[0] ?? text;
}

/** Marks what a narrow bar keeps behind More. */
export function behindMore(...els: (Element | null | undefined)[]): void {
  for (const el of els) el?.setAttribute("data-tier", "more");
}

export type Compact = { toggle: HTMLButtonElement; collapse: () => boolean };

export function createCompact(bar: HTMLElement, tip: (b: HTMLElement, text: string, key: string) => void): Compact {
  const toggle = Object.assign(document.createElement("button"), { type: "button", className: "more-toggle" });
  toggle.append(icon("more"));
  tip(toggle, "More tools", "");
  toggle.setAttribute("aria-expanded", "false");

  const isOpen = () => bar.dataset.more === "open";
  /** A press outside the bar while More is open only closes it. */
  const outside = (e: Event) => {
    if (e.composedPath().includes(bar)) return;
    e.preventDefault();
    e.stopPropagation();
    collapse();
  };
  function open() {
    bar.dataset.more = "open";
    toggle.setAttribute("aria-expanded", "true");
    window.addEventListener("pointerdown", outside, true);
  }
  /** Closes More; true when it was open (Esc then does nothing else). */
  function collapse(): boolean {
    if (!isOpen()) return false;
    delete bar.dataset.more;
    toggle.setAttribute("aria-expanded", "false");
    window.removeEventListener("pointerdown", outside, true);
    return true;
  }
  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!collapse()) open();
  });
  // Any other button chosen while More is open closes it: the page is visible again at once.
  bar.addEventListener(
    "click",
    (e) => {
      const b = (e.target as Element | null)?.closest?.("button");
      if (b && b !== toggle && isOpen()) collapse();
    },
    true,
  );
  return { toggle, collapse };
}
