// The bar's one draw button (Edvard, 2026-11-19: "bar is getting longer and longer"; his pick:
// "draw tools in one button"). It holds Pen, Arrow, Box, Ellipse, Gap and Text and shows the last
// one used: a press uses it, a second press or ▾ opens the other five in a small menu above it.
// Their keys still pick them directly and the button follows. The menu works by keyboard: the
// arrows move, Enter takes, Esc closes; Pointer's own keys leave it alone (data-own-keys).

import { closeOnOutside } from "../shared/outside";
import { buttonName } from "./compact";
import { type IconName, icon } from "./icons";
import type { Tool } from "./state";

export type DrawEntry = { tool: Tool; key: string; icon: IconName; title: string };

export type DrawMenuParts = {
  entries: readonly DrawEntry[];
  /** A button as the bar makes them, its tip set. */
  button: (entry: DrawEntry, onClick: () => void) => HTMLButtonElement;
  caret: (onClick: () => void) => HTMLButtonElement;
  tip: (b: HTMLElement, text: string, key: string) => void;
  choose: (tool: Tool) => void;
};

export type DrawMenu = { el: HTMLElement; update: (tool: Tool) => void };


/** The draw tool the button shows: the one in use, else the last one used. */
export function shownTool(entries: readonly DrawEntry[], tool: Tool, last: DrawEntry): DrawEntry {
  return entries.find((e) => e.tool === tool) ?? last;
}

export function createDrawMenu(parts: DrawMenuParts): DrawMenu {
  const first = parts.entries[0];
  if (!first) throw new Error("the draw button needs its tools");
  let shown = first;
  let current: Tool | null = null;

  const wrap = Object.assign(document.createElement("span"), { className: "drawgroup" });
  const main = parts.button(first, () => (current === shown.tool ? toggle() : parts.choose(shown.tool)));
  main.classList.add("draw");
  const caret = parts.caret(() => toggle());
  caret.classList.add("caret");
  caret.setAttribute("aria-haspopup", "menu");

  const menu = Object.assign(document.createElement("div"), { className: "menu drawmenu", hidden: true });
  menu.setAttribute("role", "menu");
  menu.setAttribute("data-own-keys", "");
  wrap.append(main, caret, menu);

  const items = () => [...menu.querySelectorAll<HTMLButtonElement>("button")];

  function fill() {
    menu.replaceChildren(
      ...parts.entries
        .filter((e) => e !== shown)
        .map((e) => {
          const b = Object.assign(document.createElement("button"), { type: "button", className: "item" });
          b.setAttribute("role", "menuitem");
          b.dataset.tool = e.tool;
          b.append(icon(e.icon), Object.assign(document.createElement("span"), { className: "name", textContent: buttonName(e.title) }));
          b.append(Object.assign(document.createElement("kbd"), { textContent: e.key }));
          parts.tip(b, e.title, e.key);
          b.addEventListener("click", (ev) => {
            ev.stopPropagation();
            close();
            parts.choose(e.tool);
          });
          return b;
        }),
    );
  }

  // ▾ may sit in the narrow bar's sheet, away from the menu (fit.ts): a press on it still toggles.
  const outside = closeOnOutside([wrap, caret], () => close());
  function open() {
    fill();
    menu.hidden = false;
    caret.setAttribute("aria-expanded", "true");
    outside.watch();
    items()[0]?.focus();
  }
  function close() {
    if (menu.hidden) return;
    menu.hidden = true;
    caret.setAttribute("aria-expanded", "false");
    outside.unwatch();
  }
  function toggle() {
    if (menu.hidden) open();
    else {
      close();
      main.focus();
    }
  }

  menu.addEventListener("keydown", (e) => {
    const list = items();
    const at = list.indexOf(e.target as HTMLButtonElement);
    const step = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (step) {
      e.preventDefault();
      list[(at + step + list.length) % list.length]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
      main.focus();
    }
  });

  return {
    el: wrap,
    update(tool) {
      current = tool;
      const next = shownTool(parts.entries, tool, shown);
      if (next !== shown) {
        shown = next;
        main.replaceChildren(icon(shown.icon));
        parts.tip(main, shown.title, shown.key);
        if (!menu.hidden) fill();
      }
      main.setAttribute("aria-pressed", String(parts.entries.some((e) => e.tool === tool)));
    },
  };
}
