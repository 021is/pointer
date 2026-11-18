// The floating bar. The 021 mark drags it; every button shows its name and key on hover. Its
// groups follow what Copy gives: drawing, crops, colours and image upload only matter for a
// picture, so Text only hides them. Copy is a split button (copy-menu.ts).

import { COLORS, type Color } from "../marks/types";
import { type CopyMenu, createCopyMenu } from "./copy-menu";
import { type IconName, icon } from "./icons";
import type { Costs } from "../capture/estimate";
import { type Output, type State, type Tool, pictureOnly } from "./state";

export type BarActions = {
  tool: (t: Tool) => void;
  color: (c: Color) => void;
  upload: () => void;
  styles: () => void;
  undo: () => void;
  clear: () => void;
  copy: () => void;
  copyAs: (o: Output) => void;
  preview: () => void;
  clearAfterCopy: (on: boolean) => void;
  estimate: () => Promise<Costs>;
  close: () => void;
};

type Entry = { tool: Tool; key: string; icon: IconName; title: string };

export const TOOLS: readonly Entry[] = [
  { tool: "page", key: "V", icon: "page", title: "Use the page" },
  { tool: "move", key: "M", icon: "move", title: "Move marks and images · Delete removes" },
  { tool: "pick", key: "P", icon: "pick", title: "Pick an element" },
  { tool: "comment", key: "C", icon: "comment", title: "Comment" },
  { tool: "crop", key: "X", icon: "crop", title: "Crop a component or a frame" },
  { tool: "pen", key: "D", icon: "pen", title: "Pen · Shift: straight" },
  { tool: "arrow", key: "A", icon: "arrow", title: "Arrow · Shift: 45°" },
  { tool: "box", key: "B", icon: "box", title: "Box · Shift: square" },
  { tool: "ellipse", key: "E", icon: "ellipse", title: "Ellipse · Shift: circle" },
  { tool: "text", key: "T", icon: "text", title: "Text on the page" },
];

export const COLOR_KEYS: readonly Color[] = ["red", "blue", "yellow"];

const MOD = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl+";

function button(name: IconName | null, tip: string, key: string, onClick: () => void, label?: string): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  if (name) b.append(icon(name));
  if (label) b.append(Object.assign(document.createElement("span"), { className: "label", textContent: label }));
  b.dataset.tip = key ? `${tip}  ${key}` : tip;
  b.setAttribute("aria-label", key ? `${tip} (${key})` : tip);
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });
  return b;
}

const group = (only?: Output) => {
  const g = Object.assign(document.createElement("span"), { className: "group" });
  if (only) g.dataset.only = only;
  return g;
};

function grip(bar: HTMLElement): HTMLElement {
  const g = Object.assign(document.createElement("span"), { className: "grip" });
  g.append(icon("mark"));
  g.dataset.tip = "Pointer by 021 · drag to move the bar";
  g.addEventListener("pointerdown", (down) => {
    down.preventDefault();
    g.setPointerCapture(down.pointerId);
    const box = bar.getBoundingClientRect();
    const dx = down.clientX - box.left;
    const dy = down.clientY - box.top;
    const move = (e: PointerEvent) => {
      bar.style.transform = "none";
      bar.style.bottom = "auto";
      bar.style.left = `${Math.max(0, Math.min(window.innerWidth - box.width, e.clientX - dx))}px`;
      bar.style.top = `${Math.max(0, Math.min(window.innerHeight - box.height, e.clientY - dy))}px`;
    };
    const up = () => {
      g.removeEventListener("pointermove", move);
      g.removeEventListener("pointerup", up);
    };
    g.addEventListener("pointermove", move);
    g.addEventListener("pointerup", up);
  });
  return g;
}

export type Toolbar = { el: HTMLElement; update: (s: State) => void; flash: (message: string) => void };

export function createToolbar(act: BarActions): Toolbar {
  const bar = document.createElement("div");
  bar.className = "bar";
  bar.setAttribute("role", "toolbar");
  bar.setAttribute("aria-label", "Pointer");
  bar.addEventListener("pointerdown", (e) => e.stopPropagation());

  const tools = new Map<Tool, HTMLButtonElement>();
  const toolButton = (t: Entry) => {
    const b = button(t.icon, t.title, t.key, () => act.tool(t.tool));
    tools.set(t.tool, b);
    return b;
  };
  const marking = group();
  const markingTools = TOOLS.filter((t) => !pictureOnly(t.tool));
  marking.append(...markingTools.map(toolButton));
  const drawing = group("picture");
  drawing.append(...TOOLS.filter((t) => pictureOnly(t.tool)).map(toolButton));

  const colors = new Map<Color, HTMLButtonElement>();
  const swatches = group("picture");
  COLOR_KEYS.forEach((c, i) => {
    const b = button(null, c[0]?.toUpperCase() + c.slice(1), String(i + 1), () => act.color(c));
    b.classList.add("swatch");
    b.style.setProperty("--swatch", COLORS[c]);
    colors.set(c, b);
    swatches.append(b);
  });
  const upload = group("picture");
  upload.append(button("upload", `Add an image (or paste: ${MOD}V)`, "", act.upload));

  const edit = group();
  edit.append(
    button("styles", "Styles of the last pick", "S", act.styles),
    button("undo", "Undo", `${MOD}Z`, act.undo),
    button("clear", "Clear everything", "", act.clear),
  );

  const menu: CopyMenu = createCopyMenu({
    copy: button("copy", "Copy for the agent", `${MOD}C`, act.copy, "Copy"),
    caret: button(null, "Choose what Copy gives, see its cost, preview it", "", () => menu.toggle(), "▾"),
    copyAs: act.copyAs,
    preview: act.preview,
    clearAfterCopy: act.clearAfterCopy,
    estimate: act.estimate,
  });
  const close = button("close", "Close", "Esc Esc", act.close);
  close.classList.add("close");

  bar.append(grip(bar), marking, drawing, swatches, upload, edit, menu.el, close);

  return {
    el: bar,
    flash: menu.flash,
    update(s) {
      bar.dataset.output = s.output;
      for (const [t, b] of tools) b.setAttribute("aria-pressed", String(t === s.tool));
      for (const [c, b] of colors) b.setAttribute("aria-pressed", String(c === s.color));
      menu.update(s);
    },
  };
}
