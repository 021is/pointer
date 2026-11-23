// Pointer on a page: the shadow-rooted layer, the bar, the tools' gestures. State lives in
// state.ts, keys in keyboard.ts and app-keys.ts, pasted images in paste/, the Screen tool in
// screen/; this file is the edge that meets the DOM. The marked page is the tab's own, or its
// copy framed at a screen size: a press is read as `client` (the tab, where Pointer's own boxes
// open), `view` (the marked page's viewport, for hit tests) and `page` (where marks are kept).

import { type DrawTool, extendShape, isMeaningful, startShape } from "../draw/shapes";
import { renderSvg } from "../marks/svg";
import type { Pin } from "../marks/types";
import { createPastedLayer } from "../paste/pasted";
import { liveLayout, shortName, viewRect } from "../pick/describe";
import { elementAt } from "../pick/walk";
import { createScreens } from "../screen/screen";
import { createSheets } from "../screen/sheets";
import { pageAt, viewAt, viewport } from "../screen/surface";
import { type Point, near } from "../shared/geometry";
import { editPlaceholder, placeholderAt } from "../shared/placeholder";
import { appKeys } from "./app-keys";
import { isBubbleOpen, openBubble } from "./bubble";
import { copyFlow } from "./copy-flow";
import { cropGestures } from "./crop-gesture";
import { gapGesture } from "./gap-gesture";
import { CSS } from "./css";
import { drag as dragOn } from "./drag";
import type { Extension, ExtensionHost } from "./extension";
import { notes, pinTarget } from "./notes";
import { handles, textAt } from "./handles";
import { createHistory } from "./history";
import { hoverer } from "./hover";
import { createKeeper } from "../keep/keep";
import { createIcons } from "../icons/icons";
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
  pinsOf,
  scenePins,
  targetsElements,
} from "./state";
import { pressStyles, stylesLook } from "./styles";
import { createToast } from "./toast";
import { createToolbar, tip } from "./toolbar";

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
  // The marks and pasted images lie on a sheet over the marked page: the whole tab, or the frame.
  const sheet = Object.assign(document.createElement("div"), { className: "sheet" });
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
  sheet.append(pasted.el, marksView);
  layer.append(sheet);
  root.append(style, layer);
  const hooks = ext(root, { rerender: () => render(), numberOf: (pin) => pinsOf(state.marks).indexOf(pin) + 1 });
  const lastPick = () => pinsOf(state.marks).findLast((p) => p.kind === "pick");
  const hist = createHistory({ state, hooks: () => hooks, update, say });
  const clear = () => hist.clear("Cleared everything.");
  const sheets = createSheets({ state, park: (pins) => hooks.park(pins), restart: hist.restart });
  const screens = createScreens({
    sheets,
    marks: () => state.marks,
    render: () => render(),
    say,
    tip,
    listeners: [
      ["keydown", ((e: KeyboardEvent) => onKey(e)) as EventListener, { capture: true }],
      ["paste", pasted.onPaste as EventListener, { capture: true }],
      ["scroll", () => render(), { passive: true, capture: true }],
    ],
  });
  const bar = createToolbar({
    screen: screens.menu.el,
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
  const flow = copyFlow({ state, host, hooks: () => hooks, say, flash: bar.flash, update, setOutput, clear: hist.clear, screen: screens.name });
  const drag = (down: PointerEvent, move: (p: Point, shift: boolean) => void, end: () => void) =>
    dragOn(layer, down, move, end);
  const icons = createIcons({ state, host, update, drag, say });
  root.append(bar.el, icons.el, toast.el);

  const layout = liveLayout;
  let frame = 0;
  function render() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      layer.dataset.tool = state.tool;
      screens.place(sheet);
      pasted.paint();
      marksView.innerHTML = renderSvg(liveScene(state, layout()), { x: 0, y: 0, ...viewport() });
      bar.update(state, stylesLook(lastPick(), hooks.panelFor(), (el) => shortName(el, viewRect(el))));
      // Only the tab's own page is kept through a reload: a framed screen is gone after one, and
      // while it shows, the tab's marks wait unchanged (their kept copy with them).
      if (screens.name() === null) keeper.schedule();
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
    icons.close();
    update(() => {
      Object.assign(state, chooseTool(state, tool));
      state.hover = null;
    });
  }

  function setOutput(output: Output) {
    update(() => Object.assign(state, chooseOutput(state, output)));
  }

  const setHover = hoverer(state, render);

  const { addPin, pick, editNote, editText, editShapeNote } = notes({ root, state, update, hooks: () => hooks });
  /** A double-click on a box or an ellipse types on it, whatever the tool. */
  function onDouble(e: MouseEvent) {
    const s = framedAt(state.marks, pageAt(e));
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
    editNote: (pin, client) => void editNote(pin, client),
    editText: (text, client) => void editText(text, client),
    onPick: (pin) => hooks.onPick(pin),
    moved: (pin) => icons.settle(pin),
  });

  function onDown(e: PointerEvent) {
    if (e.button !== 0 || isBubbleOpen(root)) return;
    const client = { x: e.clientX, y: e.clientY };
    const view = viewAt(e);
    const page = pageAt(e);
    const tool = state.tool;
    // A press on Pointer's layer never starts a text selection on the page.
    e.preventDefault();
    // Around a framed screen, or while it loads, there is nothing to mark.
    if (!screens.accepts(view)) return;
    const pin = pinAt(view);
    if (pin) return grabPin(e, pin, client, page);
    if (pasted.onDown(e) || icons.grab(e, page)) return;
    if (tool === "move") return grabMark(e, page);
    // Drawing tools draw over everything; the others grab a drawn text first.
    const text = DRAW.has(tool) ? undefined : textAt(state.marks, page);
    if (text) return grabText(e, text, client, page);
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
    } else if (tool === "icon") {
      icons.ask(client, page);
    } else if (tool === "text") {
      void openBubble(root, { at: client, placeholder: "Text on the page", hint: "Enter places it · Esc cancels" }).then(
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
    mouse = pageAt(e);
    if (e.buttons !== 0 || state.draft) return;
    const view = viewAt(e);
    const onNumber = pinAt(view) !== undefined;
    const onMark = state.tool === "move" && markAt(state.marks, mouse) !== undefined;
    layer.style.cursor = onNumber ? "pointer" : onMark ? "move" : "";
    if (targetsElements(state.tool)) setHover(onNumber || !screens.accepts(view) ? null : elementAt(view.x, view.y, host));
  }

  const onKey = appKeys({
    state,
    hist,
    pasted,
    setTool,
    setOutput,
    update,
    setHover,
    pick,
    cropElement,
    copy: () => flow.copy(),
    panel: () => pressStyles(hooks, lastPick(), say),
    clear,
    close,
    mouse: () => mouse,
  });

  const listeners: [EventTarget, string, EventListener, AddEventListenerOptions?][] = [
    [layer, "pointerdown", onDown as EventListener],
    [layer, "pointermove", onHoverMove as EventListener],
    [layer, "dblclick", onDouble as EventListener],
    [layer, "wheel", screens.wheel as EventListener, { passive: false }],
    [window, "pointermove", pasted.track as EventListener, { passive: true }],
    [window, "paste", pasted.onPaste as EventListener, { capture: true }],
    [window, "keydown", onKey as EventListener, { capture: true }],
    [window, "scroll", render, { passive: true, capture: true }],
    [window, "resize", screens.layout],
  ];

  function open() {
    document.documentElement.append(host);
    for (const [t, type, fn, opt] of listeners) t.addEventListener(type, fn, opt);
    screens.shown(true);
    render();
    if (!asked) restore();
  }
  /** Closing Pointer on purpose forgets the kept copy; the marks stay in memory until a reload,
   *  a framed screen's with its frame, hidden until Pointer opens again. */
  function close() {
    for (const [t, type, fn, opt] of listeners) t.removeEventListener(type, fn, opt);
    screens.shown(false);
    host.remove();
    keeper.forget();
  }
  return { open, close, toggle: () => (host.isConnected ? close() : open()) };
}
