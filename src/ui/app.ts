// Pointer on a page: the shadow-rooted layer, the bar, the tools' gestures and the keys. State
// lives in state.ts; this file is the edge that meets the DOM.

import { copyBundle } from "../capture/copy";
import { type DrawTool, extendShape, isMeaningful, startShape } from "../draw/shapes";
import { renderSvg } from "../marks/svg";
import type { Pin } from "../marks/types";
import { liveLayout, shortName, viewRect } from "../pick/describe";
import { elementAt, walk } from "../pick/walk";
import { type Point, dragRect, near } from "../shared/geometry";
import { componentOf } from "../source/client";
import { isBubbleOpen, openBubble } from "./bubble";
import { CSS } from "./css";
import { drag as dragOn } from "./drag";
import { commandFor } from "./keys";
import { type State, type Tool, initialState, liveScene, pinsOf, scenePins, targetsElements } from "./state";
import { createToast } from "./toast";
import { createToolbar } from "./toolbar";

export type App = { open: () => void; close: () => void; toggle: () => void };

/** What the style panel hooks into. */
export type Extension = {
  changesOf: (pin: Pin) => string[];
  onPick: (pin: Pin) => void;
  onRemove: (pin: Pin) => void;
  /** S: the panel for the last pick, or away again. */
  togglePanel: (lastPick: Pin | undefined) => void;
};

/** What the app gives the panel: a redraw, and a pin's number as the bundle shows it. */
export type ExtensionHost = { rerender: () => void; numberOf: (pin: Pin) => number };

const DRAW = new Set<Tool>(["pen", "arrow", "box", "ellipse"]);
const isEditable = (t: EventTarget | undefined) =>
  t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || (t instanceof HTMLElement && t.isContentEditable);

export function createApp(ext: (root: ShadowRoot, host: ExtensionHost) => Extension): App {
  const state: State = initialState();
  const host = document.createElement("pointer-overlay");
  host.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none;display:block;";
  const root = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = CSS;
  const layer = document.createElement("div");
  layer.className = "layer";
  const toast = createToast();
  const say = toast.say;
  root.append(style, layer);
  const hooks = ext(root, {
    rerender: () => render(),
    numberOf: (pin) => pinsOf(state.marks).indexOf(pin) + 1,
  });
  const bar = createToolbar({
    tool: setTool,
    color: (c) => update(() => (state.color = c)),
    image: () => update(() => (state.forceImage = !state.forceImage)),
    undo,
    clear,
    copy,
    close,
  });
  root.append(bar.el, toast.el);
  const drag = (down: PointerEvent, move: (p: Point, shift: boolean) => void, end: () => void) =>
    dragOn(layer, down, move, end);

  const layout = liveLayout;
  let frame = 0;
  function render() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      layer.dataset.tool = state.tool;
      layer.innerHTML = renderSvg(liveScene(state, layout()), { x: 0, y: 0, w: innerWidth, h: innerHeight });
      bar.update(state);
    });
  }
  function update(change: () => void) {
    change();
    render();
  }

  function setTool(tool: Tool) {
    update(() => {
      state.tool = tool;
      state.hover = null;
    });
  }

  function setHover(el: Element | null) {
    if (state.hover?.el === el) return;
    state.hover = el ? { el, label: shortName(el, viewRect(el)) } : null;
    render();
    if (!el) return;
    void componentOf(el).then((info) => {
      const name = info.chain[0];
      if (name && state.hover?.el === el) {
        state.hover.label = `${name} · ${shortName(el, viewRect(el))}`;
        render();
      }
    });
  }

  async function addPin(kind: Pin["kind"], el: Element, at: Point) {
    const pin: Pin = { kind, color: state.color, el, at, note: "" };
    update(() => state.marks.push(pin));
    const view = { x: at.x - scrollX, y: at.y - scrollY };
    const note = await openBubble(root, {
      at: view,
      placeholder: kind === "pick" ? "Note (optional)" : "Comment",
      hint: "Enter saves · Shift+Enter new line · Esc skips",
    });
    if (kind === "comment" && !note) return removePin(pin);
    update(() => (pin.note = note ?? ""));
  }

  function removePin(pin: Pin) {
    hooks.onRemove(pin);
    update(() => (state.marks = state.marks.filter((m) => m !== pin)));
  }

  async function editNote(pin: Pin, view: Point) {
    const note = await openBubble(root, { at: view, placeholder: "Note", value: pin.note, hint: "Enter saves · Esc keeps it" });
    if (note !== null) update(() => (pin.note = note));
  }

  function pinAt(view: Point): Pin | undefined {
    const pins = pinsOf(state.marks);
    const drawn = scenePins(state.marks, layout());
    const hit = drawn.findLast((p) => near(view, p.badge, 13));
    return hit ? pins[hit.n - 1] : undefined;
  }

  /** A crop of the component's box (followed live), its page rect kept for when it leaves. */
  function cropElement(el: Element) {
    const r = viewRect(el);
    update(() => state.marks.push({ kind: "crop", el, rect: { ...r, x: r.x + scrollX, y: r.y + scrollY } }));
  }

  /** Crop tool: a click takes the component under the cursor, a drag draws a free frame. */
  function startCrop(e: PointerEvent, page: Point, under: Element | null) {
    let moved = false;
    drag(
      e,
      (p) => {
        if (!moved && near(p, page, 4)) return;
        moved = true;
        update(() => (state.framing = dragRect(page, p, false)));
      },
      () => {
        const frame = state.framing;
        state.framing = null;
        if (!moved) return under ? cropElement(under) : render();
        if (frame && frame.w >= 8 && frame.h >= 8) state.marks.push({ kind: "crop", el: null, rect: frame });
        render();
      },
    );
  }

  function onDown(e: PointerEvent) {
    if (e.button !== 0 || isBubbleOpen(root)) return;
    e.preventDefault();
    const view = { x: e.clientX, y: e.clientY };
    const page = { x: view.x + scrollX, y: view.y + scrollY };
    const tool = state.tool;
    const pin = pinAt(view);
    if (pin) {
      // A number is a handle, whatever the tool: a click edits its note (a pick's also opens its
      // panel); a comment's number drags once the pointer moves 4px.
      let moved = false;
      return drag(
        e,
        (p) => {
          if (pin.kind !== "comment" || (!moved && near(p, page, 4))) return;
          moved = true;
          update(() => (pin.at = p));
        },
        () => {
          if (moved) return;
          if (pin.kind === "pick") hooks.onPick(pin);
          void editNote(pin, view);
        },
      );
    }
    if (tool === "pick") {
      const el = state.hover?.el ?? elementAt(view.x, view.y, host);
      if (el) void addPin("pick", el, page);
    } else if (tool === "crop") {
      startCrop(e, page, state.hover?.el ?? elementAt(view.x, view.y, host));
    } else if (tool === "comment") {
      const el = elementAt(view.x, view.y, host);
      if (el) void addPin("comment", el, page);
    } else if (tool === "text") {
      void openBubble(root, { at: view, placeholder: "Text on the page", hint: "Enter places it · Esc cancels" }).then(
        (text) => text && update(() => state.marks.push({ kind: "text", color: state.color, at: page, text })),
      );
    } else if (DRAW.has(tool)) {
      state.draft = startShape(tool as DrawTool, state.color, page);
      drag(
        e,
        (p, shift) =>
          update(() => {
            if (state.draft) state.draft = extendShape(state.draft, page, p, shift);
          }),
        () =>
          update(() => {
            if (state.draft && isMeaningful(state.draft)) state.marks.push(state.draft);
            state.draft = null;
          }),
      );
    }
  }

  function onHoverMove(e: PointerEvent) {
    if (e.buttons !== 0 || state.draft) return;
    const onNumber = pinAt({ x: e.clientX, y: e.clientY }) !== undefined;
    layer.style.cursor = onNumber ? "pointer" : "";
    if (targetsElements(state.tool)) setHover(onNumber ? null : elementAt(e.clientX, e.clientY, host));
  }

  const trail: Element[] = [];
  function onKey(e: KeyboardEvent) {
    if (isEditable(e.composedPath()[0])) return;
    const cmd = commandFor(e, state.tool);
    if (!cmd) return;
    if (cmd.type === "copy" && !getSelection()?.isCollapsed) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    switch (cmd.type) {
      case "tool":
        return setTool(cmd.tool);
      case "color":
        return update(() => (state.color = cmd.color));
      case "image":
        return update(() => (state.forceImage = !state.forceImage));
      case "undo":
        return undo();
      case "copy":
        return copy();
      case "escape":
        return state.tool === "page" ? close() : setTool("page");
      case "walk":
        if (state.hover) {
          const next = walk(state.hover.el, cmd.key, trail);
          state.hover = null;
          setHover(next);
        }
        return;
      case "pick-hover": {
        const el = state.hover?.el;
        if (!el) return;
        if (state.tool === "crop") return cropElement(el);
        const r = viewRect(el);
        void addPin("pick", el, { x: r.x + scrollX, y: r.y + scrollY });
        return;
      }
      case "panel":
        return hooks.togglePanel(pinsOf(state.marks).findLast((p) => p.kind === "pick"));
    }
  }

  function undo() {
    const last = state.marks.at(-1);
    if (!last) return;
    if (last.kind === "pick" || last.kind === "comment") return removePin(last);
    update(() => state.marks.pop());
  }

  function clear() {
    for (const pin of pinsOf(state.marks)) hooks.onRemove(pin);
    update(() => (state.marks = []));
  }

  function copy() {
    copyBundle({ state, host, changesOf: hooks.changesOf }).then(
      ({ image }) => say(image ? `Copied: text + picture ${image.w}×${image.h}. Paste it in the agent's chat.` : "Copied: text only. Paste it in the agent's chat."),
      (err: unknown) => say(`Copy failed: ${err instanceof Error ? err.message : String(err)}`, "error"),
    );
  }

  const listeners: [EventTarget, string, EventListener, AddEventListenerOptions?][] = [
    [layer, "pointerdown", onDown as EventListener],
    [layer, "pointermove", onHoverMove as EventListener],
    [window, "keydown", onKey as EventListener, { capture: true }],
    [window, "scroll", render, { passive: true, capture: true }],
    [window, "resize", render],
  ];

  function open() {
    document.documentElement.append(host);
    for (const [t, type, fn, opt] of listeners) t.addEventListener(type, fn, opt);
    render();
  }
  function close() {
    for (const [t, type, fn, opt] of listeners) t.removeEventListener(type, fn, opt);
    host.remove();
  }
  return { open, close, toggle: () => (host.isConnected ? close() : open()) };
}
