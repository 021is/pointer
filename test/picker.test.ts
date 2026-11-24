// @vitest-environment happy-dom
// The Icon tool (Edvard, 2026-11-23): a click on the page opens the picker at that spot, with five
// quick icons and More; choosing one places it centred on the spot and closes the picker; Esc or a
// press elsewhere closes it without placing. Before, the icon landed where the mouse last crossed
// onto Pointer's bar or picker (the layer's "last point"), under the open picker.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createIcons } from "../src/icons/icons";
import { createIconPicker, pickerSpot } from "../src/icons/picker";
import { QUICK } from "../src/icons/search";
import type { Mark } from "../src/marks/types";
import { initialState } from "../src/ui/state";
import { pressEscape } from "./escape";

afterEach(() => {
  globalThis.__pointerLucide = undefined;
  document.body.innerHTML = "";
});

const tick = () => new Promise((r) => setTimeout(r, 0));
const svg = Object.fromEntries([...QUICK, "bell", "bell-ring"].map((n) => [n, `<path d="${n}"/>`]));
const lucide = () => {
  globalThis.__pointerLucide = { version: "0.503.0", svg, tags: Object.fromEntries(Object.keys(svg).map((n) => [n, []])) };
};

async function picker() {
  lucide();
  const place = vi.fn();
  const p = createIconPicker({ place, say: () => {} });
  document.body.append(p.el);
  p.open({ x: 200, y: 150 }, SPOT);
  await tick();
  const buttons = () => [...p.el.querySelectorAll<HTMLButtonElement>(".quick button")];
  return { p, place, buttons, open: () => !p.el.hidden };
}

/** The clicked spot on the page (the view scrolled 1000 px). */
const SPOT = { x: 200, y: 1150 };

describe("the picker at the spot", () => {
  it("opens with the five quick icons and More, the first one focused", async () => {
    const { buttons, open } = await picker();
    expect(open()).toBe(true);
    expect(buttons().map((b) => b.getAttribute("aria-label") ?? b.textContent)).toEqual([...QUICK, "More…"]);
    expect(document.activeElement).toBe(buttons()[0]);
  });

  it("a quick icon places on the spot it was opened for, and closes", async () => {
    const { place, buttons, open } = await picker();
    buttons()[3]?.click();
    expect(place).toHaveBeenCalledWith("heart", '<path d="heart"/>', SPOT);
    expect(open()).toBe(false);
  });

  it("opened again at another spot, it places there: each opening carries its own spot", async () => {
    const { p, place, buttons } = await picker();
    p.close();
    p.open({ x: 40, y: 60 }, { x: 40, y: 60 });
    await tick();
    buttons()[0]?.click();
    expect(place).toHaveBeenCalledWith("search", '<path d="search"/>', { x: 40, y: 60 });
  });

  it("More opens the search over the rest; Enter takes the first match", async () => {
    const { p, place, buttons, open } = await picker();
    buttons().at(-1)?.click();
    const input = p.el.querySelector("input") as HTMLInputElement;
    expect(p.el.querySelector<HTMLElement>(".more")?.hidden).toBe(false);
    input.value = "bell";
    input.dispatchEvent(new Event("input"));
    expect([...p.el.querySelectorAll(".grid .icon-result")].map((b) => b.getAttribute("title"))).toEqual(["bell", "bell-ring"]);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(place).toHaveBeenCalledWith("bell", '<path d="bell"/>', SPOT);
    expect(open()).toBe(false);
  });

  it("Esc and a press elsewhere close it, placing nothing", async () => {
    const { p, place, buttons, open } = await picker();
    expect(pressEscape(buttons()[0] as Element)).toBe(true);
    expect(open()).toBe(false);
    p.open({ x: 10, y: 10 }, { x: 10, y: 10 });
    await tick();
    document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    expect(open()).toBe(false);
    expect(place).not.toHaveBeenCalled();
  });

  it("opens beside the spot, inside the view: below it, or above it near the bottom", () => {
    const view = { w: 1280, h: 800 };
    expect(pickerSpot({ x: 200, y: 150 }, view)).toEqual({ left: 214, top: 164 });
    expect(pickerSpot({ x: 1270, y: 700 }, view)).toEqual({ left: 952, bottom: 114 });
  });

  it("on a 320 px phone it stays 8 px from each side", () => {
    expect(pickerSpot({ x: 300, y: 100 }, { w: 320, h: 568 })).toEqual({ left: 8, top: 114 });
    expect(pickerSpot({ x: 20, y: 500 }, { w: 375, h: 667 })).toEqual({ left: 34, bottom: 181 });
  });
});

describe("the icon lands where the person clicked", () => {
  it("centred on the clicked spot, whatever the mouse did on the way to the picker", async () => {
    lucide();
    // happy-dom has no hit testing: nothing under the spot, so the icon is on the page itself.
    Object.defineProperty(document, "elementsFromPoint", { value: () => [], configurable: true });
    const state = initialState();
    const update = (change: () => void) => change();
    const icons = createIcons({ state, host: document.createElement("div"), update, drag: () => {}, say: () => {} });
    document.body.append(icons.el);
    // The Icon tool's click at view (300, 200), page (300, 1200): the page is scrolled 1000 px.
    icons.ask({ x: 300, y: 200 }, { x: 300, y: 1200 });
    await tick();
    // The way to the picker crosses the bar: no "last point" decides anything any more.
    window.dispatchEvent(new PointerEvent("pointermove", { clientX: 640, clientY: 760 }));
    icons.el.querySelector<HTMLButtonElement>('.quick button[aria-label="search"]')?.click();
    const icon = state.marks[0] as Extract<Mark, { kind: "icon" }>;
    expect(icon).toMatchObject({ kind: "icon", name: "search", at: { x: 284, y: 1184 }, size: 32, el: document.body });
    Reflect.deleteProperty(document, "elementsFromPoint");
  });
});
