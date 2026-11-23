// The framed page: the same URL again, in an iframe at the chosen size, inside a neutral device
// frame centred on a dim backdrop, with its size above it ("Mobile · 390 × 844"). It lives in its
// own element under Pointer's layer, so the screenshot (which hides Pointer's layer) still sees it.
// Same origin as the tab, so X-Frame-Options SAMEORIGIN and the site's cookies still work, and the
// page's media queries answer to the frame's width. The frame is sandboxed without
// allow-top-navigation: a page that breaks out of frames (top.location = …) cannot take the tab
// away, and the marks with it.

import type { Size } from "../shared/geometry";
import { type Framed, nameOf, placeFrame, screenLabel, sizeOf } from "./sizes";
import type { Surface } from "./surface";

export type StageHost = {
  /** The framed page loaded (the first time, or again after a link inside it): its window. */
  loaded: (win: Window) => void;
  /** The framed page cannot be shown, said in one sentence for the person. */
  refused: (why: string) => void;
};

/** How long a page may take to load in the frame before Pointer says so. */
const LOAD_MS = 20_000;
/** How long after loading a page may stay blank (its script hides it inside a frame). */
const BLANK_MS = 2_000;

const STYLE = `
:host { all: initial; }
.stage { position: fixed; inset: 0; background: rgba(240, 240, 245, 0.9); }
.device { position: absolute; box-sizing: border-box; background: #fbfbfd; border: 1px solid #c9c9d3;
  box-shadow: 0 24px 60px rgba(20, 20, 40, 0.25), 0 2px 6px rgba(20, 20, 40, 0.12); }
.device iframe { position: absolute; border: 0; background: #fff; transform-origin: 0 0; color-scheme: normal; }
.label { position: absolute; transform: translateX(-50%); padding: 5px 11px; border-radius: 999px; white-space: nowrap;
  font: 600 12.5px/1.2 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; color: #26252e;
  background: #fff; border: 1px solid #d6d6de; }
@media (prefers-color-scheme: dark) {
  .stage { background: rgba(8, 7, 14, 0.82); }
  .device { background: #1b1a22; border-color: #3a3946; box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6), 0 2px 6px rgba(0, 0, 0, 0.4); }
  .label { color: #ecebf3; background: #1b1a22; border-color: #3a3946; }
}
`;

/** The frame's bezel and corners, by kind: a phone's are round, a tablet's less, a custom size's least. */
const LOOK: Record<Framed["kind"], { bezel: number; radius: number }> = {
  mobile: { bezel: 10, radius: 34 },
  tablet: { bezel: 12, radius: 24 },
  custom: { bezel: 6, radius: 12 },
};

export type Stage = {
  /** Shows the page at this size: loads it the first time, else resizes the frame it has. */
  show: (screen: Framed) => void;
  /** Away from view, the framed page kept as it is (its marks wait for it). */
  hide: () => void;
  /** Gone, the framed page with it. */
  remove: () => void;
  /** The framed page as a surface, once it has loaded; null before. */
  surface: () => Surface | null;
  /** Lays the frame out again for the tab's new size. */
  layout: () => void;
};

export function createStage(h: StageHost): Stage {
  let host: HTMLElement | null = null;
  let frame: HTMLIFrameElement | null = null;
  let device: HTMLElement | null = null;
  let label: HTMLElement | null = null;
  let screen: Framed | null = null;
  let ready = false;
  let timer = 0;

  /** The frame's document when it is the tab's own origin; null when it is not (refused, or a link
   *  took it to another site), which is all a cross-origin frame lets Pointer know. */
  const sameOrigin = (f: HTMLIFrameElement): Document | null => {
    try {
      const doc = f.contentDocument;
      return doc && doc.location.origin === location.origin ? doc : null;
    } catch {
      return null; // a cross-origin frame throws on access: not ours to mark
    }
  };

  /** A page that hides itself inside a frame (`html { display: none }` until top === self). */
  const blank = (doc: Document): boolean => {
    const win = doc.defaultView;
    const body = doc.body;
    if (!win || !body) return true;
    const hidden = (el: Element) => {
      const s = win.getComputedStyle(el);
      return s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0;
    };
    return hidden(doc.documentElement) || hidden(body) || (body.childElementCount === 0 && !body.textContent?.trim());
  };

  function build(s: Framed): HTMLIFrameElement {
    host = document.createElement("pointer-screen");
    host.style.cssText = "position:fixed;inset:0;z-index:2147483646;display:block;";
    const root = host.attachShadow({ mode: "open" });
    const style = Object.assign(document.createElement("style"), { textContent: STYLE });
    const stage = Object.assign(document.createElement("div"), { className: "stage" });
    device = Object.assign(document.createElement("div"), { className: "device" });
    label = Object.assign(document.createElement("div"), { className: "label" });
    label.setAttribute("role", "status");
    const f = document.createElement("iframe");
    f.title = `This page at ${nameOf(s)} size, for Pointer`;
    f.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads");
    device.append(f);
    stage.append(device, label);
    root.append(style, stage);
    let first = true;
    f.addEventListener("load", () => {
      // Chrome loads about:blank first, at once, before the page itself: that one is not the page.
      if (f.contentDocument?.URL === "about:blank") return;
      clearTimeout(timer);
      const doc = sameOrigin(f);
      if (!doc) {
        return h.refused(
          first
            ? "This site doesn't let itself be shown inside a frame, so Pointer can't show it at another size. You're back on the full page."
            : "The framed page went to another site, which Pointer can't show at another size. You're back on the full page.",
        );
      }
      first = false;
      ready = true;
      paint();
      h.loaded(doc.defaultView ?? window);
      timer = window.setTimeout(() => {
        if (frame === f && blank(doc)) {
          h.refused("This page stays blank inside a frame (it hides itself there), so Pointer can't show it at another size. You're back on the full page.");
        }
      }, BLANK_MS);
    });
    f.src = location.href;
    document.documentElement.append(host);
    timer = window.setTimeout(() => h.refused("The page did not load in the frame in time. You're back on the full page."), LOAD_MS);
    return f;
  }

  /** The frame at its size, shrunk to fit between the label and Pointer's bar. */
  function paint() {
    if (!frame || !device || !label || !screen) return;
    const size: Size = sizeOf(screen);
    const at = placeFrame(size, { w: innerWidth, h: innerHeight });
    const { bezel, radius } = LOOK[screen.kind];
    const w = size.w * at.scale;
    const hgt = size.h * at.scale;
    device.style.cssText = `left:${at.x - bezel}px;top:${at.y - bezel}px;width:${w + 2 * bezel}px;height:${hgt + 2 * bezel}px;border-radius:${radius}px`;
    const inner = Math.max(0, radius - bezel);
    frame.style.cssText = `left:${bezel - 1}px;top:${bezel - 1}px;width:${size.w}px;height:${size.h}px;transform:scale(${at.scale});border-radius:${inner / at.scale}px`;
    label.style.cssText = `left:${innerWidth / 2}px;top:${Math.max(6, at.y - bezel - 32)}px`;
    const shrunk = at.scale < 1 ? ` · shown at ${Math.round(at.scale * 100)}%` : "";
    label.textContent = ready ? `${screenLabel(screen)}${shrunk}` : `Loading ${screenLabel(screen)}…`;
  }

  function remove() {
    clearTimeout(timer);
    host?.remove();
    host = frame = device = label = null;
    screen = null;
    ready = false;
  }

  return {
    show(s) {
      screen = s;
      frame ??= build(s);
      if (host) host.style.display = "block";
      paint();
    },
    hide() {
      // display:none keeps the frame's document alive: its marks come back with it.
      if (host) host.style.display = "none";
    },
    remove,
    surface() {
      const f = frame;
      const win = f && ready ? f.contentWindow : null;
      if (!f || !win) return null;
      return {
        win,
        box: () => {
          // The frame has no border: its content starts at its scaled box's corner. offsetWidth
          // is its own width before the transform, so the ratio is the zoom it is shown at.
          const r = f.getBoundingClientRect();
          return { x: r.left, y: r.top, scale: f.offsetWidth ? r.width / f.offsetWidth : 1 };
        },
      };
    },
    layout: paint,
  };
}
