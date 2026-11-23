// The bar's one Screen button (Edvard, 2026-11-23: "it really important the switch to be one tool
// in bar and not more"): it opens a small menu above it, Full · Tablet · Mobile · Custom, the
// current one checked. Custom opens two fields, the remembered size filled in; what is typed is
// checked before anything changes, and a wrong side says why under the fields. The menu works by
// keyboard: the arrows move, Enter takes, Esc closes; Pointer's own keys leave it alone.

import type { Size } from "../shared/geometry";
import { icon } from "../ui/icons";
import { MOBILE, type Screen, type ScreenKind, TABLET, checkCustom, isFramed, screenLabel, sizeText } from "./sizes";

export type ScreenMenuParts = {
  /** A press on a size: the controller shows it (or says why it can't). */
  choose: (s: Screen) => void;
  /** Sets the button's tip and accessible name, as the bar does for every button. */
  tip: (b: HTMLElement, text: string, key: string) => void;
};

export type ScreenMenu = { el: HTMLElement; update: (current: Screen, custom: Size | null) => void; close: () => void };

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = "") =>
  Object.assign(document.createElement(tag), { className, textContent: text });

const ROWS: readonly { kind: ScreenKind; name: string; size: Size | null }[] = [
  { kind: "full", name: "Full", size: null },
  { kind: "tablet", name: "Tablet", size: TABLET },
  { kind: "mobile", name: "Mobile", size: MOBILE },
  { kind: "custom", name: "Custom…", size: null },
];

const FALLBACK: Size = { w: 1280, h: 720 };

export function createScreenMenu(parts: ScreenMenuParts): ScreenMenu {
  const wrap = el("span", "screengroup");
  const main = el("button", "screen");
  main.type = "button";
  main.append(icon("screen"));
  main.setAttribute("aria-haspopup", "menu");
  main.setAttribute("aria-expanded", "false");
  main.addEventListener("click", (e) => {
    e.stopPropagation();
    toggle();
  });

  const pop = el("div", "menu screenmenu");
  pop.hidden = true;
  pop.setAttribute("data-own-keys", "");
  const list = el("div", "list");
  list.setAttribute("role", "menu");
  list.setAttribute("aria-label", "Screen size");
  const rows = new Map<ScreenKind, { row: HTMLButtonElement; size: HTMLElement }>();
  for (const r of ROWS) {
    const row = el("button", "item");
    row.type = "button";
    row.setAttribute("role", "menuitemradio");
    const size = el("span", "cost", r.size ? sizeText(r.size) : "");
    row.append(el("span", "dot"), el("span", "name", r.name), size);
    row.addEventListener("click", (e) => {
      e.stopPropagation();
      if (r.kind === "custom") return openForm();
      close();
      parts.choose(r.kind === "full" ? { kind: "full" } : { kind: r.kind });
    });
    rows.set(r.kind, { row, size });
    list.append(row);
  }

  const form = el("form", "custom");
  form.hidden = true;
  const field = (label: string) => {
    const input = el("input", "side");
    input.inputMode = "numeric";
    input.setAttribute("aria-label", label);
    return input;
  };
  const width = field("Width in pixels");
  const height = field("Height in pixels");
  const show = el("button", "show", "Show");
  show.type = "submit";
  const why = el("p", "why");
  why.hidden = true;
  why.setAttribute("role", "alert");
  form.append(width, el("span", "times", "×"), height, show, why);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const check = checkCustom(width.value, height.value);
    if (!check.ok) {
      why.textContent = check.why;
      why.hidden = false;
      return;
    }
    close();
    parts.choose({ kind: "custom", size: check.size });
  });
  pop.append(list, form);
  wrap.append(main, pop);

  let custom: Size | null = null;

  function openForm() {
    const size = custom ?? FALLBACK;
    width.value = String(size.w);
    height.value = String(size.h);
    why.hidden = true;
    form.hidden = false;
    width.focus();
    width.select();
  }

  const items = () => [...list.querySelectorAll<HTMLButtonElement>("button")];
  const outside = (e: Event) => {
    if (!e.composedPath().includes(wrap)) close();
  };
  function open() {
    pop.hidden = false;
    form.hidden = true;
    main.setAttribute("aria-expanded", "true");
    window.addEventListener("pointerdown", outside, true);
    (items().find((b) => b.getAttribute("aria-checked") === "true") ?? items()[0])?.focus();
  }
  function close() {
    if (pop.hidden) return;
    pop.hidden = true;
    main.setAttribute("aria-expanded", "false");
    window.removeEventListener("pointerdown", outside, true);
  }
  function toggle() {
    if (pop.hidden) return open();
    close();
    main.focus();
  }

  pop.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return main.focus();
    }
    if (e.target instanceof HTMLInputElement) return;
    const all = items();
    const at = all.indexOf(e.target as HTMLButtonElement);
    const step = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (step) {
      e.preventDefault();
      all[(at + step + all.length) % all.length]?.focus();
    }
  });

  return {
    el: wrap,
    close,
    update(current, saved) {
      custom = saved;
      for (const [kind, { row }] of rows) row.setAttribute("aria-checked", String(kind === current.kind));
      const shown = current.kind === "custom" ? current.size : saved;
      const customSize = rows.get("custom")?.size;
      if (customSize) customSize.textContent = shown ? sizeText(shown) : "";
      main.setAttribute("aria-pressed", String(isFramed(current)));
      parts.tip(main, `Screen: ${screenLabel(current)} · see the page at tablet or mobile size`, "");
    },
  };
}
