// The Screen tool's controller (Edvard, 2026-11-23: a user said "it doesn't work on mobile"):
// Full is the tab's own page; Tablet, Mobile and Custom show the same URL framed at that size,
// and Pointer marks the framed page (surface.ts) as it marks the tab's. The bar's button and menu
// are menu.ts, the frame stage.ts, the marks of each page sheets.ts, the remembered custom size
// store.ts. A page that refuses the frame is said in one sentence, and Pointer is back on Full.

import type { Mark } from "../marks/types";
import type { Point, Size } from "../shared/geometry";
import type { ScreenProbe, ScreenProbed } from "../shared/messages";
import { type ScreenMenu, createScreenMenu } from "./menu";
import type { Sheets } from "./sheets";
import { FULL, type Screen, isFramed, nameOf, sameScreen, screenLabel } from "./sizes";
import { createStage } from "./stage";
import { loadCustom, saveCustom } from "./store";
import { isFramedSurface, setSurface, surfaceBox, surfaceWin, viewport } from "./surface";

/** A listener the framed page's window needs too: keys, pastes and scrolling happen inside it. */
export type FrameListener = [type: string, fn: EventListener, options: AddEventListenerOptions];

export type ScreensHost = {
  sheets: Sheets;
  marks: () => readonly Mark[];
  render: () => void;
  say: (message: string, kind?: "ok" | "error") => void;
  tip: (b: HTMLElement, text: string, key: string) => void;
  listeners: readonly FrameListener[];
};

export type Screens = {
  menu: ScreenMenu;
  current: () => Screen;
  /** The screen's name for the bundle ("Mobile"), or null on Full. */
  name: () => string | null;
  /** Lays the sheet of marks exactly over the framed page, at its zoom (or over the whole tab). */
  place: (sheet: HTMLElement) => void;
  /** The wheel over Pointer's layer scrolls the marked page: on a framed screen, the frame's. */
  wheel: (e: WheelEvent) => void;
  /** Whether a press at this point (the surface's viewport) is on the page being marked. */
  accepts: (view: Point) => boolean;
  /** Pointer opened or closed: the frame shows and hides with it. */
  shown: (on: boolean) => void;
  layout: () => void;
};

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

export function createScreens(h: ScreensHost): Screens {
  let current: Screen = FULL;
  let custom: Size | null = null;
  /** The frame is loading its page: presses wait for it. */
  let loading = false;
  let listening: Window | null = null;

  const stage = createStage({ loaded, refused });
  const menu = createScreenMenu({ choose, tip: h.tip });
  const paint = () => {
    menu.update(current, custom);
    h.render();
  };
  loadCustom().then(
    (size) => {
      custom = size;
      paint();
    },
    (err: unknown) => h.say(`Your custom screen size could not be read: ${errorText(err)}.`, "error"),
  );

  function listen(win: Window | null) {
    if (listening) for (const [type, fn, opt] of h.listeners) listening.removeEventListener(type, fn, opt);
    listening = win;
    if (win) for (const [type, fn, opt] of h.listeners) win.addEventListener(type, fn, opt);
  }

  /** The framed page (re)loaded: Pointer marks it, hears its keys, and its probe runs. */
  function loaded(win: Window) {
    if (!isFramed(current)) return;
    loading = false;
    setSurface(stage.surface());
    listen(win);
    const ask: ScreenProbe = { type: "screen:probe" };
    chrome.runtime.sendMessage(ask).then(
      (reply: ScreenProbed | undefined) => {
        if (!reply?.ok) h.say(`On ${screenLabel(current)} Pointer can't name components: ${reply?.error ?? "the extension did not answer"}.`, "error");
      },
      (err: unknown) => h.say(`On ${screenLabel(current)} Pointer can't name components: ${errorText(err)}.`, "error"),
    );
    paint();
  }

  /** Back to Full, the framed page gone, and why said; its marks go with it, and that is said too. */
  function refused(why: string) {
    const lost = loading ? 0 : isFramed(current) ? h.marks().length : h.sheets.away().length;
    toFull();
    h.sheets.dropAway();
    stage.remove();
    h.say(lost ? `${why} Its ${lost === 1 ? "mark is" : `${lost} marks are`} gone with it.` : why, "error");
  }

  function toFull() {
    if (!isFramed(current)) return;
    listen(null);
    setSurface(null);
    h.sheets.swap();
    current = FULL;
    loading = false;
    // A frame with marks waits, hidden, for the person to come back to it; an empty one goes.
    if (h.sheets.away().length) stage.hide();
    else stage.remove();
    paint();
  }

  function choose(next: Screen) {
    if (sameScreen(next, current)) return;
    if (next.kind === "custom") {
      custom = next.size;
      saveCustom(next.size).catch((err: unknown) => h.say(`Your custom size will not be remembered: ${errorText(err)}.`, "error"));
    }
    if (!isFramed(next)) {
      toFull();
      return h.say("Full: the page as it is.");
    }
    const from = current;
    current = next;
    if (!isFramed(from)) h.sheets.swap();
    stage.show(next);
    // Refused already (stage.ts said why and Pointer is back on Full): nothing more to say.
    if (!isFramed(current)) return;
    if (!isFramed(from)) enter();
    paint();
    h.say(`${screenLabel(next)}: mark the page at this size. Full brings back the page as it was.`);
  }

  /** From Full into the frame: at once when it is still there (it kept marks), else once loaded. */
  function enter() {
    const ready = stage.surface();
    loading = !ready;
    if (!ready) return;
    setSurface(ready);
    listen(ready.win);
  }

  return {
    menu,
    current: () => current,
    name: () => (isFramed(current) ? nameOf(current) : null),
    place(sheet) {
      const framed = isFramedSurface();
      const v = viewport();
      const b = surfaceBox();
      sheet.classList.toggle("framed", framed);
      sheet.style.cssText = framed ? `left:${b.x}px;top:${b.y}px;width:${v.w}px;height:${v.h}px;transform:scale(${b.scale})` : "";
    },
    wheel(e) {
      if (!isFramedSurface()) return;
      e.preventDefault();
      surfaceWin().scrollBy(e.deltaX, e.deltaY);
    },
    accepts: (view) => {
      if (!isFramed(current)) return true;
      const v = viewport();
      return !loading && view.x >= 0 && view.y >= 0 && view.x <= v.w && view.y <= v.h;
    },
    shown(on) {
      if (!isFramed(current)) return;
      if (on) {
        stage.show(current);
        listen(stage.surface()?.win ?? null);
      } else {
        stage.hide();
        listen(null);
      }
    },
    layout: () => {
      stage.layout();
      h.render();
    },
  };
}
