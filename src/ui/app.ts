// Pointer on a page: the shadow-rooted layer, the bar, the tools' gestures. State lives in
// state.ts, keys in keyboard.ts, pasted images in paste/; this file is the edge that meets the DOM.

import { copyBundle } from "../capture/copy";
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
import { cropGestures } from "./crop-gesture";
import { CSS } from "./css";
import { drag as dragOn } from "./drag";
import type { Extension, ExtensionHost } from "./extension";
import { keyHandler } from "./keyboard";
import { notes } from "./notes";
import { handles, textAt } from "./handles";
import {
  type Output,
  type State,
  type Tool,
  initialState,
  liveScene,
  otherOutput,
  pictureOnly,
  pinsOf,
  scenePins,
  targetsElements,
} from "./state";
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
    add: (p) => update(() => state.marks.push(p)),
    update,
    say,
  });
  layer.append(pasted.el, marksView);
  root.append(style, layer);
  const hooks = ext(root, { rerender: () => render(), numberOf: (pin) => pinsOf(state.marks).indexOf(pin) + 1 });
  const lastPick = () => pinsOf(state.marks).findLast((p) => p.kind === "pick");
  const bar = createToolbar({
    tool: setTool,
    color: (c) => update(() => (state.color = c)),
    output: setOutput,
    upload: () => pasted.upload(),
    styles: () => hooks.togglePanel(lastPick()),
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
      pasted.paint();
      marksView.innerHTML = renderSvg(liveScene(state, layout()), { x: 0, y: 0, w: innerWidth, h: innerHeight });
      bar.update(state);
    });
  }
  function update(change: () => void) {
    change();
    render();
  }

  /** A drawing tool belongs to the picture: choosing one in Text switches back to Picture. */
  function setTool(tool: Tool) {
    update(() => {
      state.tool = tool;
      state.hover = null;
      if (pictureOnly(tool)) state.output = "picture";
    });
  }

  /** Text hides the drawing tools, so a drawing tool in hand goes back to pick. */
  function setOutput(output: Output) {
    update(() => {
      state.output = output;
      if (output === "text" && pictureOnly(state.tool)) state.tool = "pick";
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

  const { addPin, pick, removePin, editNote, editText } = notes({ root, state, update, hooks: () => hooks });

  function pinAt(view: Point): Pin | undefined {
    const drawn = scenePins(state.marks, layout());
    const hit = drawn.findLast((p) => near(view, p.badge, 13));
    return hit ? pinsOf(state.marks)[hit.n - 1] : undefined;
  }

  const { cropElement, startCrop } = cropGestures({ state, update, render, say, drag });
  const { grabPin, grabText } = handles({
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
    } else if (tool === "comment") {
      if (under) void addPin("comment", under, page);
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

  function onHoverMove(e: PointerEvent) {
    if (e.buttons !== 0 || state.draft) return;
    const onNumber = pinAt({ x: e.clientX, y: e.clientY }) !== undefined;
    layer.style.cursor = onNumber ? "pointer" : "";
    if (targetsElements(state.tool)) setHover(onNumber ? null : elementAt(e.clientX, e.clientY, host));
  }

  const trail: Element[] = [];
  const onKey = keyHandler(() => state.tool, {
    tool: setTool,
    color: (c) => update(() => (state.color = c)),
    image: () => setOutput(otherOutput(state.output)),
    undo,
    copy,
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
    panel: () => hooks.togglePanel(lastPick()),
    beforePaste: () => pasted.catchPaste(),
    overPasted: () => pasted.hovered() !== undefined,
    see: (direction) => {
      const p = pasted.hovered();
      if (p) pasted.see(p, direction);
    },
    remove: () => {
      const p = pasted.hovered();
      if (p) update(() => (state.marks = state.marks.filter((m) => m !== p)));
    },
  });

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
      ({ image, text }) =>
        say(
          image
            ? `Copied: picture ${image.w}×${image.h} with its text. Paste it in the agent's chat.`
            : `Copied: text only, ${text.split("\n").length} lines. Paste it in the agent's chat.`,
        ),
      (err: unknown) => say(`Copy failed: ${err instanceof Error ? err.message : String(err)}`, "error"),
    );
  }

  const listeners: [EventTarget, string, EventListener, AddEventListenerOptions?][] = [
    [layer, "pointerdown", onDown as EventListener],
    [layer, "pointermove", onHoverMove as EventListener],
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
  }
  function close() {
    for (const [t, type, fn, opt] of listeners) t.removeEventListener(type, fn, opt);
    host.remove();
  }
  return { open, close, toggle: () => (host.isConnected ? close() : open()) };
}
