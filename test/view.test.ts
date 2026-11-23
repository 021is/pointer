// @vitest-environment happy-dom
// The part of the page the person sees (shared/view.ts): on a 320 px phone a page wider than the
// screen widens the layout viewport, and Pointer's boxes must stay in the visual one. The note box
// opens beside the spot, inside that part.
import { afterEach, describe, expect, it } from "vitest";
import { openBubble } from "../src/ui/bubble";
import { showView, visibleView } from "../src/shared/view";

/** A phone in DevTools' device mode, scrolled sideways: 320 × 568 seen, 266 px from the left. */
function phone() {
  Object.defineProperty(window, "visualViewport", {
    value: { offsetLeft: 266, offsetTop: 40, width: 320, height: 568 },
    configurable: true,
  });
}

afterEach(() => {
  Reflect.deleteProperty(window, "visualViewport");
  document.body.innerHTML = "";
});

describe("the seen part", () => {
  it("is the visual viewport, in the layout viewport's coordinates", () => {
    phone();
    expect(visibleView()).toEqual({ x: 266, y: 40, w: 320, h: 568 });
  });

  it("is the window itself where there is no visual viewport", () => {
    Object.defineProperty(window, "visualViewport", { value: undefined, configurable: true });
    expect(visibleView()).toEqual({ x: 0, y: 0, w: innerWidth, h: innerHeight });
  });

  it("is written on Pointer's host as the four --view-* values its CSS reads", () => {
    phone();
    const host = document.createElement("div");
    showView(host);
    expect(["left", "top", "width", "height"].map((k) => host.style.getPropertyValue(`--view-${k}`))).toEqual(["266px", "40px", "320px", "568px"]);
  });
});

describe("the note box on a phone", () => {
  it("opens beside the spot, as wide as the seen part allows, never past its edges", () => {
    phone();
    const root = document.createElement("div").attachShadow({ mode: "open" });
    void openBubble(root, { at: { x: 560, y: 590 }, placeholder: "Comment", hint: "" });
    const box = root.querySelector(".bubble") as HTMLElement;
    // 300 px fits 320 − 16; pushed left to end 8 px inside the right edge (266 + 320 − 8 − 300).
    expect(box.style.width).toBe("300px");
    expect(box.style.left).toBe("278px");
    // Kept above the seen part's bottom (40 + 568 − 110), not below the spot.
    expect(box.style.top).toBe("498px");
  });

  it("beside a spot near the left edge, it starts 8 px inside it", () => {
    phone();
    const root = document.createElement("div").attachShadow({ mode: "open" });
    void openBubble(root, { at: { x: 200, y: 100 }, placeholder: "Comment", hint: "" });
    const box = root.querySelector(".bubble") as HTMLElement;
    expect([box.style.left, box.style.top]).toEqual(["274px", "116px"]);
  });
});
