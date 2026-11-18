// The floating bar. Every button names its key in its tooltip; the grip drags the bar out of the
// way of what is being marked.

import { COLORS, type Color } from "../marks/types";
import type { Output, State, Tool } from "./state";

export type BarActions = {
  tool: (t: Tool) => void;
  color: (c: Color) => void;
  output: (o: Output) => void;
  styles: () => void;
  undo: () => void;
  clear: () => void;
  copy: () => void;
  close: () => void;
};

type Entry = { tool: Tool; key: string; icon: string; title: string };

export const TOOLS: readonly Entry[] = [
  { tool: "page", key: "V", icon: "↖", title: "Use the page (clicks go through)" },
  { tool: "pick", key: "P", icon: "⌖", title: "Pick an element (↑ ↓ ← → walk, Enter picks)" },
  { tool: "comment", key: "C", icon: "💬", title: "Comment: click to pin a note" },
  { tool: "crop", key: "X", icon: "⛶", title: "Crop: click a component or drag a frame (several: A, B…)" },
  { tool: "pen", key: "D", icon: "✎", title: "Pen (Shift: straight)" },
  { tool: "arrow", key: "A", icon: "➚", title: "Arrow (Shift: 0/45/90°)" },
  { tool: "box", key: "B", icon: "▭", title: "Box (Shift: square)" },
  { tool: "ellipse", key: "E", icon: "◯", title: "Ellipse (Shift: circle)" },
  { tool: "text", key: "T", icon: "T", title: "Text" },
];

export const COLOR_KEYS: readonly Color[] = ["red", "blue", "yellow"];

function button(icon: string, title: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = icon;
  b.title = title;
  b.setAttribute("aria-label", title);
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });
  return b;
}

const sep = () => Object.assign(document.createElement("span"), { className: "sep" });

function grip(bar: HTMLElement): HTMLElement {
  const g = Object.assign(document.createElement("span"), { className: "grip", textContent: "⋮⋮" });
  g.title = "Drag the bar";
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

export type Toolbar = { el: HTMLElement; update: (s: State) => void };

export function createToolbar(act: BarActions): Toolbar {
  const bar = document.createElement("div");
  bar.className = "bar";
  bar.setAttribute("role", "toolbar");
  bar.setAttribute("aria-label", "Pointer");
  bar.addEventListener("pointerdown", (e) => e.stopPropagation());

  const tools = new Map<Tool, HTMLButtonElement>();
  bar.append(grip(bar));
  for (const t of TOOLS) {
    if (t.tool === "pen") bar.append(sep());
    const b = button(t.icon, `${t.title} · ${t.key}`, () => act.tool(t.tool));
    tools.set(t.tool, b);
    bar.append(b);
  }
  bar.append(sep());
  const colors = new Map<Color, HTMLButtonElement>();
  COLOR_KEYS.forEach((c, i) => {
    const b = button("", `${c} · ${i + 1}`, () => act.color(c));
    const dot = Object.assign(document.createElement("span"), { className: "dot" });
    dot.style.background = COLORS[c];
    b.append(dot);
    colors.set(c, b);
    bar.append(b);
  });
  bar.append(sep());
  // What Copy gives: a switch of two, I flips it.
  const outputs = new Map<Output, HTMLButtonElement>([
    ["picture", button("🖼 Picture", "Copy gives the picture with the text strip under it · I switches", () => act.output("picture"))],
    ["text", button("≡ Text", "Copy gives the text only, ~3× cheaper when your words say enough · I switches", () => act.output("text"))],
  ]);
  const toggle = Object.assign(document.createElement("span"), { className: "switch" });
  toggle.append(...outputs.values());
  const copy = button("⧉ Copy", "Copy for the agent · Ctrl+C", act.copy);
  copy.classList.add("copy");
  bar.append(
    button("🎨", "Styles of the last pick · S (or click a pick's number)", act.styles),
    button("↶", "Undo · Ctrl+Z", act.undo),
    button("⌫", "Clear everything", act.clear),
    sep(),
    toggle,
    copy,
    button("✕", "Close · Esc twice, or Alt+Shift+P", act.close),
  );

  return {
    el: bar,
    update(s) {
      for (const [t, b] of tools) b.setAttribute("aria-pressed", String(t === s.tool));
      for (const [c, b] of colors) b.setAttribute("aria-pressed", String(c === s.color));
      for (const [o, b] of outputs) b.setAttribute("aria-pressed", String(o === s.output));
    },
  };
}
