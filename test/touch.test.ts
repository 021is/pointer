// @vitest-environment happy-dom
// Touch (Edvard, 2026-11-23: a user said "it doesn't work on mobile", meaning Chrome DevTools'
// device mode, which sends touch pointers): every gesture works with pointerType "touch" on the
// real app (draw, move, comment, pick, icon), a pasted image moves by touch, and the layer takes
// the finger itself (touch-action: none), so the browser never turns a drag into a scroll and
// cancels it. The real browser's side is checked by hand in Chromium with touch emulation.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Pasted } from "../src/marks/types";
import { createPanel } from "../src/panel/panel";
import { createPastedLayer } from "../src/paste/pasted";
import { createApp } from "../src/ui/app";
import { CSS } from "../src/ui/css";

const wait = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const touch = (type: string, x: number, y: number) =>
  new PointerEvent(type, { pointerType: "touch", pointerId: 7, isPrimary: true, clientX: x, clientY: y, button: 0, buttons: type === "pointerup" ? 0 : 1, bubbles: true, composed: true, cancelable: true });
const key = (k: string) => window.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));

let under: Element | null = null;
beforeEach(() => {
  document.body.innerHTML = `<main><button id="join" style="width:80px;height:30px">Join</button></main>`;
  under = document.getElementById("join");
  Object.defineProperty(document, "elementsFromPoint", { value: () => (under ? [under] : []), configurable: true });
  HTMLElement.prototype.setPointerCapture = () => {};
  globalThis.__pointerLucide = { version: "0.503.0", svg: { search: "<path/>", menu: "<path/>", user: "<path/>", heart: "<path/>", plus: "<path/>" }, tags: {} };
  Object.assign(globalThis, { chrome: { runtime: { sendMessage: async () => ({ ok: true, saved: null }) } } });
});
afterEach(() => {
  Reflect.deleteProperty(document, "elementsFromPoint");
  globalThis.__pointerLucide = undefined;
  Reflect.deleteProperty(globalThis, "chrome");
  window.__pointer?.close();
  window.__pointer = undefined;
  document.documentElement.querySelector("pointer-overlay")?.remove();
});

async function pointer() {
  const app = createApp(createPanel);
  window.__pointer = app;
  app.open();
  await wait();
  const root = document.querySelector("pointer-overlay")?.shadowRoot as ShadowRoot;
  const layer = root.querySelector(".layer") as HTMLElement;
  const svg = () => root.querySelector(".layer svg")?.outerHTML ?? "";
  /** A finger: down, along the points, up. */
  const swipe = async (...points: [number, number][]) => {
    const [first, ...rest] = points;
    if (!first) return;
    layer.dispatchEvent(touch("pointerdown", ...first));
    for (const p of rest) layer.dispatchEvent(touch("pointermove", ...p));
    const last = rest.at(-1) ?? first;
    layer.dispatchEvent(touch("pointerup", ...last));
    await wait();
  };
  return { root, layer, svg, swipe };
}

describe("every gesture by touch", () => {
  it("the layer takes the finger itself: no scroll steals a drag", () => {
    expect(CSS).toMatch(/\.layer \{[^}]*touch-action: none/);
  });

  it("draws with the pen and a box, and Move drags the box", async () => {
    const { svg, swipe } = await pointer();
    key("d");
    await swipe([100, 100], [130, 120], [160, 150]);
    expect(svg()).toContain("<polyline");
    key("b");
    await swipe([200, 200], [260, 240], [300, 260]);
    expect(svg()).toMatch(/<rect [^>]*x="200" y="200" width="100" height="60" rx="4"/);
    key("m");
    await swipe([200, 230], [220, 230], [240, 230]);
    expect(svg()).toMatch(/<rect [^>]*x="240" y="200" width="100" height="60" rx="4"/);
  });

  it("a tap comments: the note box opens there", async () => {
    const { root, swipe } = await pointer();
    key("c");
    await swipe([120, 80]);
    expect(root.querySelector(".bubble textarea")).not.toBeNull();
  });

  it("a tap picks: the style box opens for the element under the finger", async () => {
    const { root, swipe } = await pointer();
    key("p");
    await swipe([20, 20]);
    const panel = root.querySelector<HTMLElement>(".panel");
    expect(panel?.hidden).toBe(false);
    expect(panel?.textContent).toContain("button");
  });

  it("a tap with the Icon tool opens the picker there, and the icon lands on that spot", async () => {
    const { root, svg, swipe } = await pointer();
    key("l");
    await swipe([150, 90]);
    root.querySelector<HTMLButtonElement>('.quick button[aria-label="heart"]')?.click();
    await wait();
    expect(svg()).toMatch(/<svg [^>]*x="134" y="74" width="32" height="32"/);
  });
});

describe("a pasted image moves by touch", () => {
  it("a finger on it drags it", () => {
    const img = new Image();
    const p: Pasted = { kind: "image", img, rect: { x: 50, y: 50, w: 100, h: 80 }, opacity: 1 };
    const layer = Object.assign(document.createElement("div"), { className: "layer" });
    const pasted = createPastedLayer({ marks: () => [p], add: () => {}, update: (c) => c(), say: () => {} });
    layer.append(pasted.el);
    document.body.append(layer);
    pasted.paint();
    const box = pasted.el.querySelector(".pimg") as HTMLElement;
    const down = touch("pointerdown", 80, 80);
    box.dispatchEvent(down);
    expect(pasted.onDown(down)).toBe(true);
    layer.dispatchEvent(touch("pointermove", 120, 110));
    layer.dispatchEvent(touch("pointerup", 120, 110));
    expect(p.rect).toMatchObject({ x: 90, y: 80, w: 100, h: 80 });
  });
});
