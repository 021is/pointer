// The icon picker, opened at the spot the person clicked with the Icon tool (Edvard, 2026-11-23:
// "select the icon and click somewhere and then we show the quick icons, first 3-5 icons and when
// click add open more we show the rest and when they select the icon it gets closed"). Five quick
// icons and More, which opens a search over all of Lucide. Choosing one places it on the spot and
// closes the picker; Esc or a press elsewhere closes it without placing. A ring marks the spot
// while it is open. Lucide's data (dist/lucide.js) is injected by the service worker the first
// time the picker opens: nothing loads before, nothing is fetched from the network.

import { lucideSvg } from "../marks/svg";
import type { Point, Size } from "../shared/geometry";
import { loadLucide } from "./data";
import { type LucideData, QUICK, searchIcons } from "./search";

export type PickerHost = {
  /** Lay the icon on the spot the picker was opened for. */
  place: (name: string, svg: string) => void;
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

export type IconPicker = { el: HTMLElement; open: (at: Point) => void; close: () => void; isOpen: () => boolean };

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
  let data: LucideData | null = null;

  function choice(name: string, svg: string): HTMLButtonElement {
    const b = Object.assign(document.createElement("button"), { type: "button", className: "icon-result", title: name });
    b.setAttribute("aria-label", name);
    b.innerHTML = SVG(svg); // Lucide's own markup, bundled with the extension: never the page's
    b.addEventListener("click", () => choose(name, svg));
    return b;
  }

  function choose(name: string, svg: string) {
    close();
    h.place(name, svg);
  }

  function fillQuick(d: LucideData) {
    const known = QUICK.filter((name) => d.svg[name] !== undefined);
    const toMore = Object.assign(document.createElement("button"), { type: "button", className: "more-button", textContent: "More…" });
    toMore.setAttribute("aria-expanded", "false");
    toMore.addEventListener("click", () => {
      more.hidden = !more.hidden;
      toMore.setAttribute("aria-expanded", String(!more.hidden));
      if (!more.hidden) {
        show();
        input.focus();
      }
    });
    quick.replaceChildren(...known.map((name) => choice(name, d.svg[name] ?? "")), toMore);
    foot.textContent = `Lucide ${d.version} (ISC) · Enter takes the first one.`;
  }

  function show() {
    if (!data) return;
    const d = data;
    const names = searchIcons(d, input.value);
    grid.replaceChildren(...names.map((name) => choice(name, d.svg[name] ?? "")));
    if (!names.length) grid.textContent = `No icon for "${input.value}".`;
  }

  input.addEventListener("input", show);
  panel.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      return close();
    }
    const first = grid.querySelector<HTMLButtonElement>(".icon-result")?.title;
    if (e.key === "Enter" && e.target === input && first && data) {
      e.preventDefault();
      choose(first, data.svg[first] ?? "");
    }
  });

  /** A press anywhere but the picker closes it, placing nothing. */
  const outside = (e: Event) => {
    if (!e.composedPath().includes(panel)) close();
  };

  function open(at: Point) {
    const spot = pickerSpot(at, { w: innerWidth, h: innerHeight });
    panel.style.cssText = "top" in spot ? `left:${spot.left}px;top:${spot.top}px` : `left:${spot.left}px;bottom:${spot.bottom}px`;
    ring.style.cssText = `left:${at.x}px;top:${at.y}px`;
    more.hidden = true;
    input.value = "";
    el.hidden = false;
    panel.focus({ preventScroll: true });
    window.addEventListener("pointerdown", outside, true);
    if (data) return void fillAndFocus(data);
    loadLucide().then(
      (d) => {
        data = d;
        if (!el.hidden) fillAndFocus(d);
      },
      (err: unknown) => {
        close();
        h.say(`The icons did not load: ${err instanceof Error ? err.message : String(err)}`, "error");
      },
    );
  }

  function fillAndFocus(d: LucideData) {
    fillQuick(d);
    quick.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
  }

  function close() {
    el.hidden = true;
    window.removeEventListener("pointerdown", outside, true);
  }

  return { el, open, close, isOpen: () => !el.hidden };
}
