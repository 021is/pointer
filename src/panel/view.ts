// The style panel's DOM for one picked element: header, file, class chips, the CSS that reaches
// it (editable), + add, ⊕ before/after, Reset. It floats over the page and never moves its layout.

import { formatSource } from "../bundle/format";
import type { ComponentInfo } from "../bundle/types";
import { shortName, viewRect } from "../pick/describe";
import type { Edited } from "./element";
import { groupProps, nudge, parseDeclaration, removedProps } from "./edits";
import { matchedProps } from "./rules";

export type ViewHooks = { changed: () => void; close: () => void };

/** A tiny element builder; `props` are plain DOM properties (className, value, title, …). */
type Props = Record<string, string | boolean | number>;
const h = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag);
  Object.assign(el, props);
  el.append(...kids);
  return el;
};

function draggable(panel: HTMLElement, handle: HTMLElement) {
  handle.addEventListener("pointerdown", (down) => {
    if ((down.target as Element).closest("button")) return;
    handle.setPointerCapture(down.pointerId);
    const box = panel.getBoundingClientRect();
    const move = (e: PointerEvent) => {
      panel.style.left = `${Math.max(0, Math.min(innerWidth - 60, box.left + e.clientX - down.clientX))}px`;
      panel.style.top = `${Math.max(0, Math.min(innerHeight - 40, box.top + e.clientY - down.clientY))}px`;
      panel.style.right = "auto";
    };
    const up = () => handle.removeEventListener("pointermove", move);
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up, { once: true });
  });
}

let propNames: string[] | null = null;
function allProps(): string[] {
  propNames ??= [...getComputedStyle(document.documentElement)].filter((p) => !p.startsWith("--")).sort();
  return propNames;
}

export function renderPanel(panel: HTMLElement, n: number, edited: Edited, info: ComponentInfo | null, hooks: ViewHooks) {
  const el = edited.el;
  const title = h("span", { className: "title", textContent: `[${n}] ${info?.chain[0] ? `${info.chain[0]} · ` : ""}${shortName(el, viewRect(el))}` });
  const collapse = h("button", { type: "button", textContent: "−", title: "Collapse · S" });
  const close = h("button", { type: "button", textContent: "✕", title: "Close the panel" });
  collapse.addEventListener("click", () => panel.toggleAttribute("data-collapsed"));
  close.addEventListener("click", hooks.close);
  const head = h("header", {}, title, collapse, close);
  draggable(panel, head);

  const body = h("div", { className: "body" });
  const rows = h("div", { className: "rows" });
  const changed = () => {
    hooks.changed();
    paintDots();
  };

  const file = info?.where.kind === "found" ? formatSource(info.where.source) : null;
  // The left-to-right marks keep ":30" and slashes in place while the start is cut with "…".
  if (file) body.append(h("div", { className: "file", textContent: `‎${file}‎`, title: file }));
  else if (info?.where.kind === "unknown") body.append(h("div", { className: "note", textContent: `File unknown: ${info.where.why}` }));

  const chips = h("div", { className: "chips" });
  const paintChips = () => {
    chips.replaceChildren(
      ...[...el.classList].map((c) => {
        const x = h("button", { type: "button", textContent: "×", title: `Remove ${c}` });
        x.addEventListener("click", () => {
          edited.removeClass(c);
          paintChips();
          changed();
        });
        return h("span", { className: "chip" }, c, x);
      }),
    );
    const add = h("input", { className: "add-class", placeholder: "+ class" });
    add.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || !add.value.trim()) return;
      for (const c of add.value.trim().split(/\s+/)) edited.addClass(c);
      paintChips();
      changed();
      chips.querySelector<HTMLInputElement>(".add-class")?.focus();
    });
    chips.append(add);
  };

  const paintDots = () => {
    for (const row of rows.querySelectorAll<HTMLElement>(".row")) {
      const e = edited.edits.props.find((p) => p.prop === row.dataset.prop);
      row.toggleAttribute("data-changed", !!e);
      row.title = e ? `was ${e.before}` : (row.dataset.from ?? "");
    }
  };

  const paintRows = () => {
    const { props, unreadable } = matchedProps(el);
    // Rows come from the edits: a property removed with × stays gone, also after reopening.
    const removed = removedProps(edited.edits);
    const names = groupProps([...props.keys(), ...edited.edits.props.map((p) => p.prop)]).filter((p) => !removed.has(p));
    const computed = getComputedStyle(el);
    rows.replaceChildren(
      ...names.map((prop) => {
        const change = edited.edits.props.find((p) => p.prop === prop)?.change;
        const box = h("input", { type: "checkbox", checked: change?.kind !== "off", title: "On / off" });
        const shown = change?.kind === "set" ? change.value : computed.getPropertyValue(prop).trim();
        const value = h("input", { className: "val", value: shown });
        const x = h("button", { type: "button", textContent: "×", title: `Remove ${prop}` });
        const row = h("div", { className: "row" }, box, h("span", { className: "name", textContent: prop }), value, h("i", { className: "dot" }), x);
        row.dataset.prop = prop;
        row.dataset.from = props.get(prop) ?? "";
        box.addEventListener("change", () => {
          if (box.checked) edited.on(prop);
          else edited.off(prop);
          changed();
        });
        value.addEventListener("keydown", (e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            const moved = nudge(value.value, (e.key === "ArrowUp" ? 1 : -1) * (e.shiftKey ? 10 : e.altKey ? 0.1 : 1));
            if (moved === null) return;
            e.preventDefault();
            value.value = moved;
          } else if (e.key === "Escape") {
            value.value = computed.getPropertyValue(prop).trim();
            return value.blur();
          } else if (e.key !== "Enter") return;
          apply();
        });
        const apply = () => {
          const refused = edited.set(prop, value.value.trim());
          tell(refused);
          if (!refused) box.checked = true;
          changed();
        };
        value.addEventListener("change", apply);
        x.addEventListener("click", () => {
          edited.remove(prop);
          paintRows();
          changed();
        });
        return row;
      }),
    );
    sheets.textContent = unreadable ? `${unreadable} stylesheet(s) from another origin can't be read.` : "";
    paintDots();
  };
  const tell = (message: string | null) => {
    warning.textContent = message ?? "";
  };

  const add = h("input", { className: "add-prop", placeholder: "+ add   gap: 12px" });
  add.setAttribute("list", "pointer-props");
  const list = h("datalist", { id: "pointer-props" }, ...allProps().map((p) => h("option", { value: p })));
  add.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const decl = parseDeclaration(add.value);
    if (!decl) return tell("write it as  property: value");
    const refused = edited.set(decl[0], decl[1]);
    tell(refused);
    if (refused) return;
    add.value = "";
    paintRows();
    changed();
  });

  const insert = (position: "before" | "after") => {
    const box = edited.insert(position);
    changed();
    const range = document.createRange();
    range.selectNodeContents(box);
    getSelection()?.removeAllRanges();
    getSelection()?.addRange(range);
    box.focus();
    box.addEventListener("input", hooks.changed);
  };
  const before = h("button", { type: "button", textContent: "⊕ before", title: "Insert a placeholder before it (type its label on the page)" });
  const after = h("button", { type: "button", textContent: "⊕ after", title: "Insert a placeholder after it" });
  const reset = h("button", { type: "button", textContent: "↺ Reset", title: "Undo every change on this element" });
  before.addEventListener("click", () => insert("before"));
  after.addEventListener("click", () => insert("after"));
  reset.addEventListener("click", () => {
    edited.reset();
    paintChips();
    paintRows();
    changed();
  });
  const warning = h("div", { className: "warning" });
  warning.setAttribute("role", "alert");
  const sheets = h("div", { className: "note" });

  body.append(chips, rows, add, warning, list, h("div", { className: "foot" }, before, after, reset), sheets);
  panel.replaceChildren(head, body);
  paintChips();
  paintRows();
}
