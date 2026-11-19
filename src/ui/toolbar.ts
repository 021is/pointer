// The floating bar. The 021 mark drags it; every button shows its name and key on hover. Its
// groups (Edvard, 2026-11-19: "group them"): [Page Move] | [Pick Comment Idea Crop] | [draw ▾]
// (draw-menu.ts) Icons | colours, image | Styles Undo Redo Clear | Picture|Text | Copy ▾. Crops, the
// drawing tools, icons, colours and image upload are for a picture, so Text hides them (Gap stays
// on its key G, its text says enough); a drawing key pressed in Text switches back to Picture.
// Copy is a split button (copy-menu.ts) whose menu also offers Picture only.

import { COLORS, type Color } from "../marks/types";
import { IS_MAC } from "../shared/platform";
import { type CopyMenu, createCopyMenu } from "./copy-menu";
import { type IconName, icon } from "./icons";
import type { Costs } from "../capture/estimate";
import { type Output, type State, type Tool, pictureOnly } from "./state";
import { type DrawEntry, createDrawMenu } from "./draw-menu";
import { REDO_KEY, UNDO_KEY } from "./history";
import type { StylesLook } from "./styles";

export type BarActions = {
  tool: (t: Tool) => void;
  color: (c: Color) => void;
  output: (o: Output) => void;
  upload: () => void;
  icons: () => void;
  styles: () => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  copy: () => void;
  copyAs: (o: Output) => void;
  preview: () => void;
  clearAfterCopy: (on: boolean) => void;
  estimate: () => Promise<Costs>;
  close: () => void;
};

/** Where a tool sits on the bar: its own button in "use" or "mark", or inside the draw button. */
type Entry = DrawEntry & { group: "use" | "mark" | "draw" };

export const TOOLS: readonly Entry[] = [
  { group: "use", tool: "page", key: "V", icon: "page", title: "Use the page" },
  { group: "use", tool: "move", key: "M", icon: "move", title: "Move marks and images · Delete removes" },
  { group: "mark", tool: "pick", key: "P", icon: "pick", title: "Pick: edit an element's CSS" },
  { group: "mark", tool: "comment", key: "C", icon: "comment", title: "Comment" },
  { group: "mark", tool: "idea", key: "Q", icon: "idea", title: "Idea: ask your agent how to make it better" },
  { group: "mark", tool: "crop", key: "X", icon: "crop", title: "Crop a component or a frame" },
  { group: "draw", tool: "pen", key: "D", icon: "pen", title: "Pen · Shift: straight" },
  { group: "draw", tool: "arrow", key: "A", icon: "arrow", title: "Arrow · Shift: 45°" },
  { group: "draw", tool: "box", key: "B", icon: "box", title: "Box · Shift: square" },
  { group: "draw", tool: "ellipse", key: "E", icon: "ellipse", title: "Ellipse · Shift: circle" },
  { group: "draw", tool: "gap", key: "G", icon: "gap", title: "Gap: drag from one element to another to measure the space" },
  { group: "draw", tool: "text", key: "T", icon: "text", title: "Text on the page" },
];

export const COLOR_KEYS: readonly Color[] = ["red", "blue", "yellow"];

const MOD = IS_MAC ? "⌘" : "Ctrl+";
const CLEAR_KEY = IS_MAC ? "⇧⌫" : "Shift+Delete";

/** A button's hover tip and its accessible name, with its key. */
function tip(b: HTMLElement, text: string, key: string) {
  b.dataset.tip = key ? `${text}  ${key}` : text;
  b.setAttribute("aria-label", key ? `${text} (${key})` : text);
}

function button(name: IconName | null, text: string, key: string, onClick: () => void, label?: string): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  if (name) b.append(icon(name));
  if (label) b.append(Object.assign(document.createElement("span"), { className: "label", textContent: label }));
  tip(b, text, key);
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

export type Toolbar = { el: HTMLElement; update: (s: State, styles: StylesLook) => void; flash: (message: string) => void };

export function createToolbar(act: BarActions): Toolbar {
  const bar = document.createElement("div");
  bar.className = "bar";
  bar.setAttribute("role", "toolbar");
  bar.setAttribute("aria-label", "Pointer");
  bar.addEventListener("pointerdown", (e) => e.stopPropagation());

  const tools = new Map<Tool, HTMLButtonElement>();
  const toolButton = (t: Entry) => {
    const b = button(t.icon, t.title, t.key, () => act.tool(t.tool));
    if (pictureOnly(t.tool)) b.dataset.only = "picture";
    tools.set(t.tool, b);
    return b;
  };
  const using = group();
  using.append(...TOOLS.filter((t) => t.group === "use").map(toolButton));
  const marking = group();
  marking.append(...TOOLS.filter((t) => t.group === "mark").map(toolButton));
  const draw = createDrawMenu({
    entries: TOOLS.filter((t) => t.group === "draw"),
    button: (e, onClick) => button(e.icon, e.title, e.key, onClick),
    caret: (onClick) => button(null, "More drawing tools", "", onClick, "▾"),
    tip,
    choose: act.tool,
  });
  const drawing = group("picture");
  drawing.append(draw.el, button("icons", "Icons: search Lucide, click one or drag it onto the page", "", act.icons));

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

  const styles = button("styles", "Styles of the last pick", "S", act.styles);
  const edit = group();
  edit.append(
    styles,
    button("undo", "Undo", UNDO_KEY, act.undo),
    button("redo", "Redo", REDO_KEY, act.redo),
    button("clear", "Clear everything", CLEAR_KEY, act.clear),
  );

  const menu: CopyMenu = createCopyMenu({
    copy: button("copy", "Copy for the agent", `${MOD}C`, act.copy, "Copy"),
    caret: button(null, "Choose what Copy gives, see its cost, preview it", "", () => menu.toggle(), "▾"),
    copyAs: act.copyAs,
    preview: act.preview,
    clearAfterCopy: act.clearAfterCopy,
    estimate: act.estimate,
  });
  // Picture lights for both picture outputs; the Copy menu tells Picture + text from Picture only.
  const outputs = new Map<"picture" | "text", HTMLButtonElement>([
    ["picture", button("picture", "Copy gives a picture", "I", () => act.output("picture"), "Picture")],
    ["text", button("textOnly", "Copy gives the text only, ~3× cheaper", "I", () => act.output("text"), "Text")],
  ]);
  const toggle = Object.assign(document.createElement("span"), { className: "switch" });
  toggle.append(...outputs.values());
  const close = button("close", "Close", "Esc Esc", act.close);
  close.classList.add("close");

  bar.append(grip(bar), using, marking, drawing, swatches, upload, edit, toggle, menu.el, close);

  return {
    el: bar,
    flash: menu.flash,
    update(s, look) {
      bar.dataset.output = s.output;
      styles.dataset.state = look.state;
      styles.setAttribute("aria-pressed", String(look.state === "open"));
      tip(styles, look.tip, "S");
      for (const [t, b] of tools) b.setAttribute("aria-pressed", String(t === s.tool));
      draw.update(s.tool);
      for (const [c, b] of colors) b.setAttribute("aria-pressed", String(c === s.color));
      const lit = s.output === "text" ? "text" : "picture";
      for (const [o, b] of outputs) b.setAttribute("aria-pressed", String(o === lit));
      menu.update(s);
    },
  };
}
