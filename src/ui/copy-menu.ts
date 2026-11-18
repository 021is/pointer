// Copy as a split button (Edvard, 2026-11-18): a click copies the way you chose last; ▾ opens a
// menu with what each output costs before you choose, "clear after copy", and a preview in a new
// tab. The confirmation shows on the button itself, not as a toast over the bar.

import type { Costs } from "../capture/estimate";
import { OUTPUTS, type Output, type State } from "./state";

export type CopyMenuParts = {
  copy: HTMLButtonElement;
  caret: HTMLButtonElement;
  copyAs: (o: Output) => void;
  preview: () => void;
  clearAfterCopy: (on: boolean) => void;
  estimate: () => Promise<Costs>;
};

export type CopyMenu = { el: HTMLElement; toggle: () => void; update: (s: State) => void; flash: (message: string) => void };

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = "") =>
  Object.assign(document.createElement(tag), { className, textContent: text });

const SHORT: Record<Output, string> = { picture: "Picture", text: "Text", image: "Picture only" };

export function createCopyMenu(parts: CopyMenuParts): CopyMenu {
  const wrap = el("span", "copygroup");
  const { copy, caret } = parts;
  copy.classList.add("copy");
  caret.classList.add("caret");
  const mode = el("span", "mode");
  copy.append(mode);

  const menu = el("div", "menu");
  menu.hidden = true;
  menu.setAttribute("role", "menu");
  const items = new Map<Output, { row: HTMLButtonElement; cost: HTMLElement }>();
  for (const { output, label } of OUTPUTS) {
    const row = el("button", "item");
    row.type = "button";
    row.setAttribute("role", "menuitemradio");
    const cost = el("span", "cost", "…");
    row.append(el("span", "dot"), el("span", "name", label), cost);
    row.addEventListener("click", () => {
      close();
      parts.copyAs(output);
    });
    items.set(output, { row, cost });
    menu.append(row);
  }
  const clear = el("button", "item check");
  clear.type = "button";
  clear.setAttribute("role", "menuitemcheckbox");
  clear.append(el("span", "box"), el("span", "name", "Clear after copy"));
  clear.addEventListener("click", () => parts.clearAfterCopy(clear.getAttribute("aria-checked") !== "true"));
  const preview = el("button", "item");
  preview.type = "button";
  preview.append(el("span", "dot ghost"), el("span", "name", "Preview in a new tab"));
  preview.addEventListener("click", () => {
    close();
    parts.preview();
  });
  menu.append(el("div", "rule"), clear, preview);
  menu.addEventListener("pointerdown", (e) => e.stopPropagation());
  wrap.append(copy, caret, menu);

  const outside = (e: Event) => {
    if (!e.composedPath().includes(wrap)) close();
  };
  function close() {
    menu.hidden = true;
    caret.setAttribute("aria-expanded", "false");
    window.removeEventListener("pointerdown", outside, true);
  }
  function open() {
    menu.hidden = false;
    caret.setAttribute("aria-expanded", "true");
    window.addEventListener("pointerdown", outside, true);
    for (const { cost } of items.values()) cost.textContent = "…";
    parts.estimate().then(
      (costs) => {
        for (const [o, { cost }] of items) cost.textContent = costs[o] ? `≈ ${costs[o]} tok` : "—";
      },
      () => {
        for (const { cost } of items.values()) cost.textContent = "";
      },
    );
  }

  let flashing = 0;
  const label = copy.querySelector(".label");
  return {
    el: wrap,
    toggle: () => (menu.hidden ? open() : close()),
    update(s) {
      mode.textContent = `· ${SHORT[s.output]}`;
      for (const [o, { row }] of items) row.setAttribute("aria-checked", String(o === s.output));
      clear.setAttribute("aria-checked", String(s.clearAfterCopy));
    },
    flash(message) {
      clearTimeout(flashing);
      copy.classList.add("flash");
      if (label) label.textContent = `✓ ${message}`;
      mode.hidden = true;
      flashing = window.setTimeout(() => {
        copy.classList.remove("flash");
        if (label) label.textContent = "Copy";
        mode.hidden = false;
      }, 2800);
    },
  };
}
