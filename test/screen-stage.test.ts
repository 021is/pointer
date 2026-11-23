// @vitest-environment happy-dom
// The framed page (Edvard, 2026-11-23: "a frame around the screen so it shows like mobile"): the
// same URL in a sandboxed iframe at the chosen size, shrunk to fit, its size above it. A page that
// refuses the frame (X-Frame-Options DENY, frame-ancestors 'none': Chrome then shows an error page
// of another origin) or hides itself inside one is said in one sentence.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createStage } from "../src/screen/stage";

afterEach(() => {
  vi.useRealTimers();
  document.documentElement.querySelector("pointer-screen")?.remove();
});

function stage() {
  const loaded = vi.fn();
  const refused = vi.fn();
  const s = createStage({ loaded, refused });
  s.show({ kind: "mobile" });
  const root = document.querySelector("pointer-screen")?.shadowRoot;
  const frame = root?.querySelector("iframe") as HTMLIFrameElement;
  /** What Chrome lets Pointer see of the frame: its document and window, or nothing (another origin). */
  const answer = (doc: Document | null) => {
    Object.defineProperty(frame, "contentDocument", { get: () => doc, configurable: true });
    Object.defineProperty(frame, "contentWindow", { get: () => (doc ? window : null), configurable: true });
  };
  return { s, loaded, refused, root, frame, answer };
}

/** A same-origin document as the frame would hold it. */
function page(body: string): Document {
  const doc = document.implementation.createHTMLDocument("framed");
  doc.body.innerHTML = body;
  Object.defineProperty(doc, "location", { value: { origin: location.origin }, configurable: true });
  Object.defineProperty(doc, "URL", { value: location.href, configurable: true });
  Object.defineProperty(doc, "defaultView", { value: window, configurable: true });
  return doc;
}

describe("the frame", () => {
  it("loads the same URL, sandboxed with no way to navigate the tab, at the screen's size", () => {
    const { frame, root } = stage();
    expect(frame.getAttribute("src")).toBe(location.href);
    const sandbox = frame.getAttribute("sandbox") ?? "";
    expect(sandbox).toContain("allow-same-origin");
    expect(sandbox).toContain("allow-scripts");
    expect(sandbox).not.toContain("allow-top-navigation");
    expect(frame.style.width).toBe("390px");
    expect(frame.style.height).toBe("844px");
    expect(root?.querySelector(".label")?.textContent).toBe("Loading Mobile · 390 × 844…");
  });

  it("once loaded, names its size and zoom, and hands its window over", () => {
    const { frame, answer, loaded, root, s } = stage();
    answer(page("<main>Hello</main>"));
    frame.dispatchEvent(new Event("load"));
    expect(loaded).toHaveBeenCalledWith(window);
    expect(root?.querySelector(".label")?.textContent).toMatch(/^Mobile · 390 × 844( · shown at \d+%)?$/);
    expect(s.surface()?.win).toBe(window);
  });

  it("the about:blank Chrome loads first is not the page: neither loaded nor refused", () => {
    const { frame, answer, refused, loaded } = stage();
    const blank = page("");
    Object.defineProperty(blank, "URL", { value: "about:blank", configurable: true });
    answer(blank);
    frame.dispatchEvent(new Event("load"));
    expect(loaded).not.toHaveBeenCalled();
    expect(refused).not.toHaveBeenCalled();
  });

  it("a page that refuses the frame is said, in words for anyone", () => {
    const { frame, answer, refused, loaded } = stage();
    answer(null);
    frame.dispatchEvent(new Event("load"));
    expect(loaded).not.toHaveBeenCalled();
    expect(refused).toHaveBeenCalledWith(
      "This site doesn't let itself be shown inside a frame, so Pointer can't show it at another size. You're back on the full page.",
    );
  });

  it("a page that hides itself inside a frame, or stays empty, is said too", () => {
    vi.useFakeTimers();
    const { frame, answer, refused } = stage();
    const doc = page("");
    answer(doc);
    frame.dispatchEvent(new Event("load"));
    vi.advanceTimersByTime(2_000);
    expect(refused).toHaveBeenCalledWith(expect.stringMatching(/^This page stays blank inside a frame/));
  });

  it("a page that does not load in time is said", () => {
    vi.useFakeTimers();
    const { refused } = stage();
    vi.advanceTimersByTime(20_000);
    expect(refused).toHaveBeenCalledWith("The page did not load in the frame in time. You're back on the full page.");
  });

  it("a link inside the frame to another site is said, and differently", () => {
    const { frame, answer, refused } = stage();
    answer(page("<main>Hello</main>"));
    frame.dispatchEvent(new Event("load"));
    answer(null);
    frame.dispatchEvent(new Event("load"));
    expect(refused).toHaveBeenCalledWith(expect.stringMatching(/^The framed page went to another site/));
  });
});
