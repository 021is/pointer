// The part of the page the person sees: the visual viewport. On a phone-sized page (Chrome
// DevTools' device mode) a page wider than the screen widens the layout viewport (innerWidth 586
// on a 320 px phone), and `position: fixed` boxes are laid out in that wider one. Pointer's own
// boxes (the bar, the toast, the style box, the note box, the icon picker) stay in the seen part:
// in JS through visibleView(), in CSS through the --view-* properties set on Pointer's host.

import type { Rect } from "./geometry";

/** The seen part, in the layout viewport's coordinates (where fixed boxes are placed). */
export function visibleView(): Rect {
  const v = window.visualViewport;
  return v ? { x: v.offsetLeft, y: v.offsetTop, w: v.width, h: v.height } : { x: 0, y: 0, w: innerWidth, h: innerHeight };
}

/** Writes the seen part on `host` as --view-left, --view-top, --view-width and --view-height.
 *  A box kept at its bottom is placed by `top` and `translateY(-100%)`: the layout viewport's
 *  height is not what a fixed box's `bottom` counts from on every phone. */
export function showView(host: HTMLElement): void {
  const v = visibleView();
  host.style.setProperty("--view-left", `${v.x}px`);
  host.style.setProperty("--view-top", `${v.y}px`);
  host.style.setProperty("--view-width", `${v.w}px`);
  host.style.setProperty("--view-height", `${v.h}px`);
}
