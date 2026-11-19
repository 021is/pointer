// @vitest-environment happy-dom
// The Styles button and S on the real panel: every press opens, closes or says why (Edvard,
// 2026-11-19: "sometimes I click nothing happens").
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Pin } from "../src/marks/types";

vi.mock("../src/source/client", () => ({
  componentOf: vi.fn(async () => ({ framework: "none", chain: [], where: { kind: "silent" } })),
}));

const { createPanel } = await import("../src/panel/panel");
const { pressStyles, stylesLook } = await import("../src/ui/styles");

let said: string[];
let root: ShadowRoot;
const panelEl = () => root.querySelector(".panel") as HTMLElement;
const pin = (el: Element): Pin => ({ kind: "pick", color: "red", el, at: { x: 0, y: 0 }, note: "" });
const name = (el: Element) => el.className;

function setup() {
  document.body.innerHTML = `<button class="a">A</button><button class="b">B</button>`;
  root = document.createElement("div").attachShadow({ mode: "open" });
  said = [];
  return createPanel(root, { rerender: () => {}, numberOf: () => 1 });
}
const press = (hooks: ReturnType<typeof setup>, p: Pin | undefined) => pressStyles(hooks, p, (m) => said.push(m));

beforeEach(() => {
  said = [];
});

describe("a press on Styles always does something", () => {
  it("with no pick yet: says how to make one", () => {
    const hooks = setup();
    press(hooks, undefined);
    expect(said).toEqual(["No pick yet: press P, then click an element to change its styles."]);
    expect(panelEl().hidden).toBe(true);
  });

  it("when the picked element left the page: says pick it again, opens nothing", () => {
    const hooks = setup();
    const a = pin(document.querySelector(".a") as Element);
    a.el.remove();
    press(hooks, a);
    expect(said[0]).toMatch(/left the page .*pick it again/);
    expect(panelEl().hidden).toBe(true);
  });

  it("a collapsed box opens again instead of closing", () => {
    const hooks = setup();
    const a = pin(document.querySelector(".a") as Element);
    press(hooks, a);
    panelEl().setAttribute("data-collapsed", "");
    press(hooks, a);
    expect(panelEl().hidden).toBe(false);
    expect(panelEl().hasAttribute("data-collapsed")).toBe(false);
    press(hooks, a);
    expect(panelEl().hidden).toBe(true);
    expect(said).toEqual([]);
  });

  it("a box open for another pick switches to the last pick", () => {
    const hooks = setup();
    const a = pin(document.querySelector(".a") as Element);
    const b = pin(document.querySelector(".b") as Element);
    hooks.onPick(a);
    press(hooks, b);
    expect(hooks.panelFor()).toBe(b);
  });
});

describe("the button says what a press would do", () => {
  it("empty, ready with the element's name, open", () => {
    setup();
    const a = pin(document.querySelector(".a") as Element);
    expect(stylesLook(undefined, null, name).state).toBe("empty");
    expect(stylesLook(a, null, name)).toEqual({ state: "ready", tip: "Styles of a" });
    expect(stylesLook(a, a, name).state).toBe("open");
    a.el.remove();
    expect(stylesLook(a, null, name).state).toBe("empty");
  });
});
