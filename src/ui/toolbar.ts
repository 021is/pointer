// The floating bar. The 021 mark drags it; every button shows its name and key on hover. Its
// groups (Edvard, 2026-11-19: "group them"): [Page Move] | [Pick Comment Idea Crop] | [draw ▾]
// (draw-menu.ts) Icon | colours, image | Styles Undo Redo Clear | Picture|Text | Copy ▾. Crops, the
// drawing tools, icons, colours and image upload are for a picture, so Text hides them (Gap stays
// on its key G, its text says enough); a drawing key pressed in Text switches back to Picture.
// Copy is a split button (copy-menu.ts) whose menu also offers Picture only. On a narrow viewport
// the bar keeps what fits (fit.ts) and puts the rest behind More (compact.ts), in the tool sheet's
// groups (sheet.ts): the same buttons, moved between the arrangements (layout.ts).

import { COLORS, type Color } from "../marks/types";
import { IS_MAC } from "../shared/platform";
import { NARROW, buttonName, createCompact, staysOpen } from "./compact";
import { type CopyMenu, createCopyMenu } from "./copy-menu";
import { fitRow, seenPart } from "./fit";
import { type IconName, icon } from "./icons";
import type { Costs } from "../capture/estimate";
import { type Output, type State, type Tool, pictureOnly } from "./state";
import { type DrawEntry, createDrawMenu } from "./draw-menu";
import { REDO_KEY, UNDO_KEY } from "./history";
import { type Parts, createLayout } from "./layout";
import { createSheet } from "./sheet";
import type { StylesLook } from "./styles";

export type BarActions = {
  tool: (t: Tool) => void;
  color: (c: Color) => void;
  output: (o: Output) => void;
  upload: () => void;
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

/** Where a tool sits on the bar: its own button in "use", "mark" or "icon", or inside the draw button. */
type Entry = DrawEntry & { group: "use" | "mark" | "draw" | "icon" };

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
  { group: "icon", tool: "icon", key: "L", icon: "icons", title: "Icon: click a spot, then choose an icon" },
];

export const COLOR_KEYS: readonly Color[] = ["red", "blue", "yellow"];

/** The narrow sheet shows the colours only for what they colour by hand: the draw button's tools
 *  and Icon (Edvard, 2026-11-24). The keys 1, 2, 3 work with every tool. */
export const colorsShown = (tool: Tool) => TOOLS.some((t) => t.tool === tool && (t.group === "draw" || t.group === "icon"));

const MOD = IS_MAC ? "⌘" : "Ctrl+";
const CLEAR_KEY = IS_MAC ? "⇧⌫" : "Shift+Delete";

/** A button's hover tip and its accessible name, with its key; and its short name, shown under
 *  its icon in the narrow bar's open sheet. */
function tip(b: HTMLElement, text: string, key: string) {
  b.dataset.tip = key ? `${text}  ${key}` : text;
  b.dataset.name = buttonName(text);
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

const group = () => Object.assign(document.createElement("span"), { className: "group" });

/** The picture-only controls: Text hides them (and a wide bar's group left with none of its own). */
const forPicture = (...els: HTMLElement[]) => {
  for (const el of els) el.dataset.only = "picture";
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

/** The seen width, as the narrow bar's CSS reads it (--view-width, shared/view.ts). */
const seenWidth = () => Math.round(window.visualViewport?.width ?? window.innerWidth);

/** One of the bar's own elements, by its class. */
function partOf(root: Element, selector: string): HTMLElement {
  const el = root.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`the bar has no ${selector}`);
  return el;
}

/** Runs a re-arrangement and gives focus back to the button that had it: moving a node drops it. */
function keepingFocus(bar: HTMLElement, arrange: () => void) {
  const root = bar.getRootNode();
  const had = root instanceof ShadowRoot ? root.activeElement : bar.ownerDocument.activeElement;
  arrange();
  if (had instanceof HTMLElement && bar.contains(had)) had.focus();
}

export type Toolbar = {
  el: HTMLElement;
  update: (s: State, styles: StylesLook) => void;
  flash: (message: string) => void;
  /** A narrow bar's sheet, closed; true when it was open. */
  collapse: () => boolean;
};

export function createToolbar(act: BarActions): Toolbar {
  const bar = document.createElement("div");
  bar.className = "bar";
  bar.setAttribute("role", "toolbar");
  bar.setAttribute("aria-label", "Pointer");
  bar.addEventListener("pointerdown", (e) => e.stopPropagation());

  const tools = new Map<Tool, HTMLButtonElement>();
  for (const t of TOOLS.filter((e) => e.group !== "draw")) {
    const b = button(t.icon, t.title, t.key, () => act.tool(t.tool));
    if (pictureOnly(t.tool)) forPicture(b);
    tools.set(t.tool, b);
  }
  const own = (t: Tool) => {
    const b = tools.get(t);
    if (!b) throw new Error(`the bar has no ${t} button`);
    return b;
  };
  const draw = createDrawMenu({
    entries: TOOLS.filter((t) => t.group === "draw"),
    button: (e, onClick) => button(e.icon, e.title, e.key, onClick),
    caret: (onClick) => button(null, "More drawing tools", "", onClick, "▾"),
    tip,
    choose: act.tool,
  });

  const colors = new Map<Color, HTMLButtonElement>();
  const swatches = group();
  swatches.classList.add("colors");
  COLOR_KEYS.forEach((c, i) => {
    const b = button(null, c[0]?.toUpperCase() + c.slice(1), String(i + 1), () => act.color(c));
    b.classList.add("swatch");
    b.style.setProperty("--swatch", COLORS[c]);
    colors.set(c, b);
    swatches.append(b);
  });
  const image = button("upload", `Add an image (or paste: ${MOD}V)`, "", act.upload);
  forPicture(draw.el, swatches, image);

  const styles = button("styles", "Styles of the last pick", "S", act.styles);
  const undo = button("undo", "Undo", UNDO_KEY, act.undo);
  const redo = button("redo", "Redo", REDO_KEY, act.redo);
  const clear = button("clear", "Clear everything", CLEAR_KEY, act.clear);

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
  const close = button("close", "Close Pointer", "Esc Esc", act.close);
  close.classList.add("close");

  const sheet = createSheet();
  const compact = createCompact(bar, sheet.el, tip);
  staysOpen(undo, redo, clear, swatches, toggle);

  const tool = { page: own("page"), move: own("move"), pick: own("pick"), comment: own("comment"), idea: own("idea"), crop: own("crop"), icon: own("icon") };
  const carets = { drawCaret: partOf(draw.el, ".caret"), copyCaret: partOf(menu.el, ".caret") };
  const parts: Parts = { ...tool, ...carets, draw: draw.el, colors: swatches, image, undo, redo, clear, styles, output: toggle, copy: menu.el };
  const layout = createLayout(bar, parts, { grip: grip(bar), exit: close, toggle: compact.toggle, sheet });
  layout.wide();
  // The narrow bar is laid out again when its width or the output changes (fit.ts), and its sheet
  // closed when the width changes; app.ts updates the bar on every resize.
  const narrow = window.matchMedia(NARROW);
  let laidFor = "wide";
  let laidAs = "";
  function place(output: Output) {
    const width = narrow.matches ? String(seenWidth()) : "wide";
    if (width === laidFor && (width === "wide" || laidAs === output)) return;
    if (width !== laidFor) compact.collapse();
    laidFor = width;
    laidAs = output;
    keepingFocus(bar, () => (narrow.matches ? layout.narrow(fitRow(seenWidth(), output)) : layout.wide()));
  }

  return {
    el: bar,
    flash: menu.flash,
    collapse: compact.collapse,
    update(s, look) {
      place(s.output);
      bar.dataset.output = s.output;
      const colorsSeen = colorsShown(s.tool);
      bar.dataset.colors = colorsSeen ? "shown" : "hidden";
      sheet.show((p) => seenPart(p, s.output, colorsSeen));
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
