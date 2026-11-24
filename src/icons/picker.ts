// The icon picker, opened at the spot the person clicked with the Icon tool (Edvard, 2026-11-23:
// "select the icon and click somewhere and then we show the quick icons, first 3-5 icons and when
// click add open more we show the rest and when they select the icon it gets closed"). Five quick
// icons and More, which opens a search over all of Lucide. Choosing one places it on the spot and
// closes the picker; Esc or a press elsewhere closes it without placing. A ring marks the spot
// while it is open. Lucide's data (dist/lucide.js) is injected by the service worker the first
// time the picker opens: nothing loads before, nothing is fetched from the network.

import { lucideSvg } from "../marks/svg";
import { closesOnEscape } from "../shared/escape";
import type { Point, Size } from "../shared/geometry";
import { closeOnOutside } from "../shared/outside";
import { loadLucide } from "./data";
import { type LucideData, QUICK, searchIcons } from "./search";

export type PickerHost = {
  /** Lay the icon on `page`, the spot the picker was opened for (page coordinates). */
  place: (name: string, svg: string, page: Point) => void;
  say: (message: string, kind?: "ok" | "error") => void;
};

/** The picker at its widest and tallest (More open), to keep it inside the view. */
const WIDTH = 320;
const TALL = 340;
const GAP = 14;

export type PickerSpot = { left: number; top: number } | { left: number; bottom: number };

/** Where the picker opens for a click at `at` (viewport): beside the spot, below it when there is
 *  room, else above it; always inside the view and never over the spot itself. */
export function pickerSpot(at: Point, view: Size): PickerSpot {
  // On a narrow view (320 px) the picker is as wide as the view allows, 8 px from each side.
  const width = Math.min(WIDTH, view.w - 16);
  const left = Math.max(8, Math.min(at.x + GAP, view.w - width - 8));
  if (at.y + GAP + TALL <= view.h - 8 || at.y < view.h / 2) return { left, top: Math.max(8, at.y + GAP) };
  return { left, bottom: Math.max(8, view.h - at.y + GAP) };
}

const SVG = (inner: string) => lucideSvg(inner, "currentColor");

/** Chooses an icon for the spot this opening of the picker is for, and closes it. */
type Pick = (name: string, svg: string) => void;

export type IconPicker = {
  el: HTMLElement;
  /** Opens beside `at` (the viewport point clicked); a choice lands on `page` (the same spot). */
  open: (at: Point, page: Point) => void;
  close: () => void;
};

export function createIconPicker(h: PickerHost): IconPicker {
  const el = Object.assign(document.createElement("div"), { className: "iconpick", hidden: true });
  const ring = Object.assign(document.createElement("div"), { className: "icon-spot" });
  const panel = Object.assign(document.createElement("div"), { className: "iconpicker", tabIndex: -1 });
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Choose an icon");
  panel.setAttribute("data-own-keys", "");
  panel.addEventListener("pointerdown", (e) => e.stopPropagation());
  const quick = Object.assign(document.createElement("div"), { className: "quick", textContent: "Loading icons…" });
  const more = Object.assign(document.createElement("div"), { className: "more", hidden: true });
  const input = Object.assign(document.createElement("input"), { type: "search", placeholder: "Search all icons: calendar, arrow…" });
  input.setAttribute("aria-label", "Search all icons");
  const grid = Object.assign(document.createElement("div"), { className: "grid" });
  const foot = Object.assign(document.createElement("p"), { className: "foot" });
  more.append(input, grid, foot);
  panel.append(quick, more);
  el.append(ring, panel);
  const outside = closeOnOutside(panel, close);
  let data: LucideData | null = null;

  function choice(name: string, svg: string, pick: Pick): HTMLButtonElement {
    const b = Object.assign(document.createElement("button"), { type: "button", className: "icon-result", title: name });
    b.setAttribute("aria-label", name);
    b.innerHTML = SVG(svg); // Lucide's own markup, bundled with the extension: never the page's
    b.addEventListener("click", () => pick(name, svg));
    return b;
  }

  function fillQuick(d: LucideData, pick: Pick) {
    const known = QUICK.filter((name) => d.svg[name] !== undefined);
    const toMore = Object.assign(document.createElement("button"), { type: "button", className: "more-button", textContent: "More…" });
    toMore.setAttribute("aria-expanded", "false");
    toMore.addEventListener("click", () => {
      more.hidden = !more.hidden;
      toMore.setAttribute("aria-expanded", String(!more.hidden));
      if (!more.hidden) {
        show(d, pick);
        input.focus();
      }
    });
    quick.replaceChildren(...known.map((name) => choice(name, d.svg[name] ?? "", pick)), toMore);
    foot.textContent = `Lucide ${d.version} (ISC) · Enter takes the first one.`;
    // This opening's search: typing filters, Enter takes the first match.
    input.oninput = () => show(d, pick);
    input.onkeydown = (e) => {
      const first = grid.querySelector<HTMLButtonElement>(".icon-result")?.title;
      if (e.key !== "Enter" || !first) return;
      e.preventDefault();
      pick(first, d.svg[first] ?? "");
    };
    quick.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
  }

  function show(d: LucideData, pick: Pick) {
    const names = searchIcons(d, input.value);
    grid.replaceChildren(...names.map((name) => choice(name, d.svg[name] ?? "", pick)));
    if (!names.length) grid.textContent = `No icon for "${input.value}".`;
  }

  // Keys typed in the picker stay in it; Esc closes it (the window's look at Esc runs this,
  // shared/escape.ts, and the page never sees that Esc).
  panel.addEventListener("keydown", (e) => e.stopPropagation());
  closesOnEscape(panel, () => close());

  function open(at: Point, page: Point) {
    const pick: Pick = (name, svg) => {
      close();
      h.place(name, svg, page);
    };
    const spot = pickerSpot(at, { w: innerWidth, h: innerHeight });
    panel.style.cssText = "top" in spot ? `left:${spot.left}px;top:${spot.top}px` : `left:${spot.left}px;bottom:${spot.bottom}px`;
    ring.style.cssText = `left:${at.x}px;top:${at.y}px`;
    more.hidden = true;
    input.value = "";
    el.hidden = false;
    panel.focus({ preventScroll: true });
    outside.watch();
    if (data) return fillQuick(data, pick);
    loadLucide().then(
      (d) => {
        data = d;
        if (!el.hidden) fillQuick(d, pick);
      },
      (err: unknown) => {
        close();
        h.say(`The icons did not load: ${err instanceof Error ? err.message : String(err)}`, "error");
      },
    );
  }

  function close() {
    el.hidden = true;
    outside.unwatch();
  }

  return { el, open, close };
}
