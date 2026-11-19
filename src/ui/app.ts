// Pointer on a page: the shadow-rooted layer, the bar, the tools' gestures. State lives in
// state.ts, keys in keyboard.ts, pasted images in paste/; this file is the edge that meets the DOM.

import { type DrawTool, extendShape, isMeaningful, startShape } from "../draw/shapes";
import { renderSvg } from "../marks/svg";
import type { Pin } from "../marks/types";
import { createPastedLayer } from "../paste/pasted";
import { liveLayout, shortName, viewRect } from "../pick/describe";
import { elementAt, walk } from "../pick/walk";
import { type Point, near } from "../shared/geometry";
import { editPlaceholder, placeholderAt } from "../shared/placeholder";
import { componentOf } from "../source/client";
import { isBubbleOpen, openBubble } from "./bubble";
import { copyFlow } from "./copy-flow";
import { cropGestures } from "./crop-gesture";
import { gapGesture } from "./gap-gesture";
import { CSS } from "./css";
import { drag as dragOn } from "./drag";
import type { Extension, ExtensionHost } from "./extension";
import { keyHandler } from "./keyboard";
import { notes, pinTarget } from "./notes";
import { handles, textAt } from "./handles";
import { createHistory } from "./history";
import { createKeeper } from "../keep/keep";
import { markAt } from "./move";
import {
  type Output,
  type State,
  type Tool,
  afterPaste,
  framedAt,
  initialState,
  liveScene,
  chooseOutput,
  chooseTool,
  otherOutput,
  pinsOf,
  scenePins,
  targetsElements,
} from "./state";
import { pressStyles, stylesLook } from "./styles";
import { createToast } from "./toast";
import { createToolbar } from "./toolbar";

export type App = { open: () => void; close: () => void; toggle: () => void };

const DRAW = new Set<Tool>(["pen", "arrow", "box", "ellipse"]);

export function createApp(ext: (root: ShadowRoot, host: ExtensionHost) => Extension): App {
  const state: State = initialState();
  const host = document.createElement("pointer-overlay");
  host.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none;display:block;";
  const root = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = CSS;
  const layer = document.createElement("div");
  layer.className = "layer";
  const marksView = document.createElement("div");
  const toast = createToast();
  const say = toast.say;
  const pasted = createPastedLayer({
    marks: () => state.marks,
    add: (p) =>
      update(() => {
        state.marks.push(p);
        Object.assign(state, afterPaste(state));
        state.hover = null;
      }),
    update,
    say,
  });
  layer.append(pasted.el, marksView);
  root.append(style, layer);
  const hooks = ext(root, { rerender: () => render(), numberOf: (pin) => pinsOf(state.marks).indexOf(pin) + 1 });
  const lastPick = () => pinsOf(state.marks).findLast((p) => p.kind === "pick");
  const hist = createHistory({ state, hooks: () => hooks, update, say });
  const clear = () => hist.clear("Cleared everything.");
  const bar = createToolbar({
    tool: setTool,
    color: (c) => update(() => (state.color = c)),
    output: (o) => setOutput(o),
    upload: () => pasted.upload(),
    styles: () => pressStyles(hooks, lastPick(), say),
    undo: hist.undo,
    redo: hist.redo,
    clear,
    copy: () => flow.copy(),
    copyAs: (o) => flow.copyAs(o),
    preview: () => void flow.preview(),
    clearAfterCopy: (on) => update(() => (state.clearAfterCopy = on)),
    estimate: () => flow.estimate(),
    close,
  });
  const flow = copyFlow({ state, host, hooks: () => hooks, say, flash: bar.flash, update, setOutput, clear: hist.clear });
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
      pasted.paint();
      marksView.innerHTML = renderSvg(liveScene(state, layout()), { x: 0, y: 0, w: innerWidth, h: innerHeight });
      bar.update(state, stylesLook(lastPick(), hooks.panelFor(), (el) => shortName(el, viewRect(el))));
      keeper.schedule();
    });
  }

  // Marks outlive a reload of the page (keep/): asked for once, when Pointer first opens on it.
  const keeper = createKeeper({ marks: () => state.marks, editsOf: (pin) => hooks.editsOf(pin), say });
  let asked = false;
  const restore = () => {
    asked = true;
    void keeper.restore((marks) => update(() => (state.marks = marks)), hooks.replay);
  };
  function update(change: () => void) {
    change();
    render();
  }

  function setTool(tool: Tool) {
    update(() => {
      Object.assign(state, chooseTool(state, tool));
      state.hover = null;
    });
  }

  function setOutput(output: Output) {
    update(() => Object.assign(state, chooseOutput(state, output)));
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

  const { addPin, pick, editNote, editText, editShapeNote } = notes({ root, state, update, hooks: () => hooks });
  /** A double-click on a box or an ellipse types on it, whatever the tool. */
  function onDouble(e: MouseEvent) {
    const s = framedAt(state.marks, { x: e.clientX + scrollX, y: e.clientY + scrollY });
    if (s) void editShapeNote(s, { x: e.clientX, y: e.clientY });
  }

  function pinAt(view: Point): Pin | undefined {
    const drawn = scenePins(state.marks, layout());
    const hit = drawn.findLast((p) => near(view, p.badge, 13));
    return hit ? pinsOf(state.marks)[hit.n - 1] : undefined;
  }

  const { cropElement, startCrop } = cropGestures({ state, update, render, say, drag });
  const { startGap } = gapGesture({ state, root, host, update, say, drag });
  const { grabPin, grabText, grabMark } = handles({
    state,
    update,
    drag,
    editNote: (pin, view) => void editNote(pin, view),
    editText: (text, view) => void editText(text, view),
    onPick: (pin) => hooks.onPick(pin),
  });

  function onDown(e: PointerEvent) {
    if (e.button !== 0 || isBubbleOpen(root)) return;
    const view = { x: e.clientX, y: e.clientY };
    const page = { x: view.x + scrollX, y: view.y + scrollY };
    const tool = state.tool;
    const pin = pinAt(view);
    // A press on Pointer's layer never starts a text selection on the page.
    e.preventDefault();
    if (pin) return grabPin(e, pin, view, page);
    if (pasted.onDown(e)) return;
    if (tool === "move") return grabMark(e, page);
    // Drawing tools draw over everything; the others grab a drawn text first.
    const text = DRAW.has(tool) ? undefined : textAt(state.marks, page);
    if (text) return grabText(e, text, view, page);
    const under = elementAt(view.x, view.y, host);
    // A ⊕ placeholder is Pointer's own: a click edits its label, whatever the tool.
    const box = placeholderAt(under);
    if (box) return editPlaceholder(box, view);
    if (tool === "pick") {
      const el = state.hover?.el ?? under;
      if (el) pick(el, page);
    } else if (tool === "crop") {
      startCrop(e, page, state.hover?.el ?? under);
    } else if (tool === "comment" || tool === "idea") {
      const el = pinTarget(tool, under);
      if (el) void addPin(tool, el, page);
    } else if (tool === "gap") {
      startGap(e, page);
    } else if (tool === "text") {
      void openBubble(root, { at: view, placeholder: "Text on the page", hint: "Enter places it · Esc cancels" }).then(
        (text) => text && update(() => state.marks.push({ kind: "text", color: state.color, at: page, text })),
      );
    } else if (DRAW.has(tool)) {
      state.draft = startShape(tool as DrawTool, state.color, page);
      const move = (p: Point, shift: boolean) =>
        update(() => {
          if (state.draft) state.draft = extendShape(state.draft, page, p, shift);
        });
      drag(e, move, () =>
        update(() => {
          if (state.draft && isMeaningful(state.draft)) state.marks.push(state.draft);
          state.draft = null;
        }),
      );
    }
  }

  let mouse: Point = { x: 0, y: 0 };
  function onHoverMove(e: PointerEvent) {
    mouse = { x: e.clientX + scrollX, y: e.clientY + scrollY };
    if (e.buttons !== 0 || state.draft) return;
    const onNumber = pinAt({ x: e.clientX, y: e.clientY }) !== undefined;
    const onMark = state.tool === "move" && markAt(state.marks, mouse) !== undefined;
    layer.style.cursor = onNumber ? "pointer" : onMark ? "move" : "";
    if (targetsElements(state.tool)) setHover(onNumber ? null : elementAt(e.clientX, e.clientY, host));
  }

  const trail: Element[] = [];
  const onKey = keyHandler(() => state.tool, {
    tool: setTool,
    color: (c) => update(() => (state.color = c)),
    image: () => setOutput(otherOutput(state.output)),
    undo: hist.undo,
    redo: hist.redo,
    copy: () => flow.copy(),
    escape: () => (state.tool === "page" ? close() : setTool("page")),
    walk: (key) => {
      if (!state.hover) return;
      const next = walk(state.hover.el, key, trail);
      state.hover = null;
      setHover(next);
    },
    take: () => {
      const el = state.hover?.el;
      if (!el) return;
      if (state.tool === "crop") return cropElement(el);
      const r = viewRect(el);
      pick(el, { x: r.x + scrollX, y: r.y + scrollY });
    },
    panel: () => pressStyles(hooks, lastPick(), say),
    beforePaste: () => pasted.catchPaste(),
    overPasted: () => pasted.hovered() !== undefined,
    canRemove: () => pasted.hovered() !== undefined || (state.tool === "move" && markAt(state.marks, mouse) !== undefined),
    see: (direction) => {
      const p = pasted.hovered();
      if (p) pasted.see(p, direction);
    },
    remove: () => {
      const gone = pasted.hovered() ?? (state.tool === "move" ? markAt(state.marks, mouse) : undefined);
      if (gone) update(() => (state.marks = state.marks.filter((m) => m !== gone)));
    },
    clear,
  });

  const listeners: [EventTarget, string, EventListener, AddEventListenerOptions?][] = [
    [layer, "pointerdown", onDown as EventListener],
    [layer, "pointermove", onHoverMove as EventListener],
    [layer, "dblclick", onDouble as EventListener],
    [window, "pointermove", pasted.track as EventListener, { passive: true }],
    [window, "paste", pasted.onPaste as EventListener, { capture: true }],
    [window, "keydown", onKey as EventListener, { capture: true }],
    [window, "scroll", render, { passive: true, capture: true }],
    [window, "resize", render],
  ];

  function open() {
    document.documentElement.append(host);
    for (const [t, type, fn, opt] of listeners) t.addEventListener(type, fn, opt);
    render();
    if (!asked) restore();
  }
  /** Closing Pointer on purpose forgets the kept copy; the marks stay in memory until a reload. */
  function close() {
    for (const [t, type, fn, opt] of listeners) t.removeEventListener(type, fn, opt);
    host.remove();
    keeper.forget();
  }
  return { open, close, toggle: () => (host.isConnected ? close() : open()) };
}
