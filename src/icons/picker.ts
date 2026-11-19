// The icon picker's panel: search Lucide by name and tags as you type, click an icon to add it, or
// drag it onto the page. Lucide's data (dist/lucide.js) is injected by the service worker the
// first time the panel opens: nothing loads before, nothing is fetched from the network.

import type { Point } from "../shared/geometry";
import type { IconsLoad, IconsLoaded } from "../shared/messages";
import { type LucideData, searchIcons } from "./search";

declare global {
  // Set by dist/lucide.js in the content script's world.
  var __pointerLucide: LucideData | undefined;
}

export type PickerHost = {
  /** Lay the icon on the page: at a viewport point (a drop), or null for the last point. */
  place: (name: string, svg: string, at: Point | null) => void;
  say: (message: string, kind?: "ok" | "error") => void;
};

const SVG = (inner: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

async function lucide(): Promise<LucideData> {
  if (globalThis.__pointerLucide) return globalThis.__pointerLucide;
  const ask: IconsLoad = { type: "icons:load" };
  const reply = (await chrome.runtime.sendMessage(ask)) as IconsLoaded | undefined;
  if (!reply?.ok) throw new Error(reply?.error ?? "the extension did not answer (reload it in chrome://extensions)");
  if (!globalThis.__pointerLucide) throw new Error("Lucide's icons did not load");
  return globalThis.__pointerLucide;
}

export function createIconPicker(h: PickerHost) {
  const el = Object.assign(document.createElement("div"), { className: "iconpicker", hidden: true });
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", "Icons");
  el.setAttribute("data-own-keys", "");
  el.addEventListener("pointerdown", (e) => e.stopPropagation());
  const input = Object.assign(document.createElement("input"), { type: "search", placeholder: "Search icons: calendar, heart, arrow…" });
  const grid = Object.assign(document.createElement("div"), { className: "grid" });
  const foot = Object.assign(document.createElement("p"), { className: "foot", textContent: "Click to add, or drag onto the page." });
  el.append(input, grid, foot);
  let data: LucideData | null = null;

  function show() {
    if (!data) return;
    const d = data;
    const names = searchIcons(d, input.value);
    grid.replaceChildren(...names.map((name) => result(name, d.svg[name] ?? "")));
    if (!names.length) grid.textContent = `No icon for "${input.value}".`;
  }

  function result(name: string, svg: string): HTMLButtonElement {
    const b = Object.assign(document.createElement("button"), { type: "button", className: "icon-result", title: name });
    b.setAttribute("aria-label", name);
    b.innerHTML = SVG(svg); // Lucide's own markup, bundled with the extension: never the page's
    b.addEventListener("pointerdown", (down) => drag(down, b, name, svg));
    return b;
  }

  /** A press: a click adds the icon at the last point; a drag past 6 px drops it where let go. */
  function drag(down: PointerEvent, b: HTMLButtonElement, name: string, svg: string) {
    down.preventDefault();
    b.setPointerCapture(down.pointerId);
    let ghost: HTMLElement | null = null;
    const move = (e: PointerEvent) => {
      if (!ghost && Math.hypot(e.clientX - down.clientX, e.clientY - down.clientY) < 6) return;
      ghost ??= Object.assign(document.createElement("div"), { className: "icon-ghost", innerHTML: SVG(svg) });
      if (!ghost.isConnected) el.append(ghost);
      ghost.style.transform = `translate(${e.clientX - 16}px, ${e.clientY - 16}px)`;
    };
    const up = (e: PointerEvent) => {
      b.removeEventListener("pointermove", move);
      b.removeEventListener("pointerup", up);
      const dropped = ghost !== null;
      ghost?.remove();
      const r = el.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!dropped) h.place(name, svg, null);
      else if (!inside) h.place(name, svg, { x: e.clientX, y: e.clientY });
    };
    b.addEventListener("pointermove", move);
    b.addEventListener("pointerup", up);
  }

  input.addEventListener("input", show);
  input.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Escape") close();
    const first = grid.querySelector<HTMLButtonElement>(".icon-result")?.title;
    if (e.key === "Enter" && first && data) h.place(first, data.svg[first] ?? "", null);
  });

  async function open() {
    el.hidden = false;
    input.focus();
    try {
      data ??= await lucide();
      foot.textContent = `Lucide ${data.version} (ISC) · click to add, or drag onto the page.`;
      show();
    } catch (err) {
      h.say(`The icons did not load: ${String(err instanceof Error ? err.message : err)}`, "error");
    }
  }
  function close() {
    el.hidden = true;
  }

  return { el, toggle: () => (el.hidden ? void open() : close()), isOpen: () => !el.hidden };
}
