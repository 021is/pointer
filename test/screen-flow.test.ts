// @vitest-environment happy-dom
// The Screen tool's flow (Edvard, 2026-11-23), with the frame stubbed: choosing Mobile waits for
// the frame, then marks the framed page; each page keeps its own marks; Full brings back the
// tab's; a page that refuses the frame puts Pointer back on Full and says why; the custom size is
// remembered.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mark } from "../src/marks/types";
import type { StageHost } from "../src/screen/stage";

const frame = vi.hoisted(() => ({
  host: null as StageHost | null,
  ready: false,
  win: { name: "framed", innerWidth: 390, innerHeight: 844, scrollX: 0, scrollY: 0 } as unknown as Window,
  shown: [] as string[],
  removed: 0,
  hidden: 0,
}));
vi.mock("../src/screen/stage", () => ({
  createStage: (h: StageHost) => {
    frame.host = h;
    return {
      show: (s: { kind: string }) => frame.shown.push(s.kind),
      hide: () => frame.hidden++,
      remove: () => {
        frame.removed++;
        frame.ready = false;
      },
      surface: () => (frame.ready ? { win: frame.win, box: () => ({ x: 400, y: 44, scale: 0.5 }) } : null),
      layout: () => {},
    };
  },
}));

const { createScreens } = await import("../src/screen/screen");
const { createSheets } = await import("../src/screen/sheets");
const { isFramedSurface, setSurface, surfaceWin, viewAt } = await import("../src/screen/surface");
const { initialState } = await import("../src/ui/state");

let saved: Record<string, unknown>;
const sent: unknown[] = [];
beforeEach(() => {
  Object.assign(frame, { host: null, ready: false, shown: [], removed: 0, hidden: 0 });
  saved = {};
  sent.length = 0;
  vi.stubGlobal("chrome", {
    runtime: {
      sendMessage: async (m: unknown) => {
        sent.push(m);
        return { ok: true };
      },
    },
    storage: {
      local: {
        get: async (k: string) => (k in saved ? { [k]: saved[k] } : {}),
        set: async (items: Record<string, unknown>) => Object.assign(saved, items),
      },
    },
  });
});
afterEach(() => {
  setSurface(null);
  vi.unstubAllGlobals();
});

function setup() {
  const state = initialState();
  const tabMark: Mark = { kind: "text", color: "red", at: { x: 5, y: 5 }, text: "on the tab" };
  state.marks = [tabMark];
  const said: [string, string | undefined][] = [];
  const restarts = vi.fn();
  const sheets = createSheets({ state, park: () => () => {}, restart: restarts });
  const screens = createScreens({
    sheets,
    marks: () => state.marks,
    render: () => {},
    say: (m, kind) => said.push([m, kind]),
    tip: () => {},
    listeners: [],
  });
  return { state, tabMark, said, restarts, screens };
}

const load = () => {
  frame.ready = true;
  frame.host?.loaded(frame.win);
};

describe("choosing a screen", () => {
  it("Mobile waits for its frame, then marks the framed page; the tab's marks wait on Full", async () => {
    const { state, screens, restarts } = setup();
    screens.menu.el.querySelector<HTMLButtonElement>('.item[role="menuitemradio"]:nth-child(3)')?.click();
    expect(frame.shown).toEqual(["mobile"]);
    expect(state.marks).toEqual([]);
    expect(restarts).toHaveBeenCalled();
    expect(screens.accepts({ x: 10, y: 10 })).toBe(false);
    load();
    expect(isFramedSurface()).toBe(true);
    expect(surfaceWin()).toBe(frame.win);
    // A press on the tab maps into the framed page (its box at 400, 44, shown at half size).
    expect(viewAt({ clientX: 500, clientY: 144 })).toEqual({ x: 200, y: 200 });
    expect(sent).toEqual([{ type: "screen:probe" }]);
    expect(screens.name()).toBe("Mobile");
    // The wheel over Pointer's layer scrolls the framed page, not the tab hidden behind it.
    const scrollBy = vi.fn();
    Object.assign(frame.win, { scrollBy });
    const wheel = new WheelEvent("wheel", { deltaY: 120, cancelable: true });
    screens.wheel(wheel);
    expect(scrollBy).toHaveBeenCalledWith(0, 120);
    expect(wheel.defaultPrevented).toBe(true);
  });

  it("each page keeps its own marks: Full brings the tab's back, and the framed page's wait with its frame", async () => {
    const { state, tabMark, screens, said } = setup();
    const choose = (name: string) =>
      [...screens.menu.el.querySelectorAll<HTMLButtonElement>(".item")].find((b) => b.querySelector(".name")?.textContent === name)?.click();
    choose("Mobile");
    load();
    const framedMark: Mark = { kind: "text", color: "blue", at: { x: 9, y: 9 }, text: "on mobile" };
    state.marks.push(framedMark);
    choose("Tablet");
    expect(frame.shown).toEqual(["mobile", "tablet"]);
    expect(state.marks).toEqual([framedMark]);
    choose("Full");
    expect(state.marks).toEqual([tabMark]);
    expect(isFramedSurface()).toBe(false);
    expect(frame.hidden).toBe(1);
    expect(frame.removed).toBe(0);
    expect(said.at(-1)?.[0]).toBe("Full: the page as it is.");
    choose("Mobile");
    expect(state.marks).toEqual([framedMark]);
    expect(screens.accepts({ x: 10, y: 10 })).toBe(true);
  });

  it("a page that refuses the frame puts Pointer back on Full and says why", () => {
    const { state, tabMark, screens, said } = setup();
    [...screens.menu.el.querySelectorAll<HTMLButtonElement>(".item")][2]?.click();
    frame.host?.refused("This site doesn't let itself be shown inside a frame, so Pointer can't show it at another size. You're back on the full page.");
    expect(screens.current()).toEqual({ kind: "full" });
    expect(state.marks).toEqual([tabMark]);
    expect(isFramedSurface()).toBe(false);
    expect(frame.removed).toBeGreaterThan(0);
    expect(said.at(-1)).toEqual([
      "This site doesn't let itself be shown inside a frame, so Pointer can't show it at another size. You're back on the full page.",
      "error",
    ]);
  });

  it("a framed page lost later takes its marks with it, and says so", () => {
    const { state, screens, said } = setup();
    [...screens.menu.el.querySelectorAll<HTMLButtonElement>(".item")][2]?.click();
    load();
    state.marks.push({ kind: "text", color: "red", at: { x: 1, y: 1 }, text: "a" }, { kind: "text", color: "red", at: { x: 2, y: 2 }, text: "b" });
    frame.host?.refused("The framed page went to another site, which Pointer can't show at another size. You're back on the full page.");
    expect(said.at(-1)?.[0]).toMatch(/You're back on the full page\. Its 2 marks are gone with it\.$/);
    expect(state.marks).toEqual([expect.objectContaining({ text: "on the tab" })]);
    expect(screens.name()).toBeNull();
  });

  it("a custom size is shown and remembered for next time", async () => {
    const { screens } = setup();
    [...screens.menu.el.querySelectorAll<HTMLButtonElement>(".item")][3]?.click();
    const [w, h] = [...screens.menu.el.querySelectorAll<HTMLInputElement>("form.custom input")];
    if (w && h) [w.value, h.value] = ["1024", "600"];
    screens.menu.el.querySelector<HTMLFormElement>("form.custom")?.requestSubmit();
    expect(screens.current()).toEqual({ kind: "custom", size: { w: 1024, h: 600 } });
    await Promise.resolve();
    expect(saved).toEqual({ "screen:custom": { w: 1024, h: 600 } });
  });
});
