// @vitest-environment happy-dom
// The screenshots for crops scrolled out of view (Edvard, 2026-11-24): Pointer's layer hidden,
// the page scrolled to each stop, the capture taken there, and the scroll put back exactly where
// the person left it, once, after the last capture. The capture itself is stubbed.
import { afterEach, describe, expect, it, vi } from "vitest";

const events: string[] = [];
vi.mock("../src/capture/picture", () => ({
  screenshot: vi.fn(async () => {
    events.push(`capture at ${scrollY}`);
    return { naturalWidth: 400, naturalHeight: 800 };
  }),
}));

const { shoot } = await import("../src/capture/shots");
import type { Crop } from "../src/marks/types";
import type { Scene } from "../src/marks/svg";

const scene: Scene = { pins: [], shapes: [], frames: [] };

/** Free crops (no element) at page positions, as the page lays them out at the current scroll. */
function page(crops: { y: number; h: number }[]) {
  const marks: Crop[] = crops.map((c) => ({ kind: "crop", el: null, rect: { x: 20, y: c.y, w: 300, h: c.h } }));
  const now = () => ({
    frames: marks.map((m, i) => ({ label: String.fromCharCode(65 + i), rect: { ...m.rect, y: m.rect.y - scrollY } })),
    scene,
    laid: [],
    whole: { x: 0, y: 0, w: innerWidth, h: innerHeight },
  });
  return { marks, now };
}

function at(y: number) {
  window.happyDOM.setViewport({ width: 400, height: 800 });
  document.body.style.height = "6000px";
  window.scrollTo({ top: y, behavior: "instant" });
  const scrolls = vi.spyOn(window, "scrollTo");
  scrolls.mockImplementation(((opts: ScrollToOptions) => {
    events.push(`scroll to ${opts.top}`);
    Object.defineProperty(window, "scrollY", { value: opts.top ?? 0, configurable: true });
  }) as typeof window.scrollTo);
  Object.defineProperty(window, "scrollY", { value: y, configurable: true });
  Object.defineProperty(document.documentElement, "scrollHeight", { value: 6000, configurable: true });
  return scrolls;
}

afterEach(() => {
  events.length = 0;
  vi.restoreAllMocks();
});

describe("shoot", () => {
  it("with every crop in view: one capture where the page is, and nothing else moves", async () => {
    at(1000);
    const { marks, now } = page([{ y: 1100, h: 100 }]);
    const host = document.createElement("div");
    const shots = await shoot(host, marks, now);
    expect(events).toEqual(["capture at 1000"]);
    expect(shots.cuts.map((c) => c.region)).toEqual([{ label: "A", rect: { x: 20, y: 100, w: 300, h: 100 } }]);
    expect(shots.larger).toEqual([]);
  });

  it("scrolls to each crop out of view, captures there, then puts the scroll back exactly, once", async () => {
    const scrolls = at(1234);
    const { marks, now } = page([
      { y: 1300, h: 100 },
      { y: 4000, h: 100 },
      { y: 100, h: 100 },
    ]);
    const host = document.createElement("div");
    const hidden: string[] = [];
    const shots = await shoot(host, marks, () => {
      hidden.push(host.style.visibility);
      return now();
    });
    expect(events).toEqual(["capture at 1234", "scroll to 0", "capture at 0", "scroll to 3650", "capture at 3650", "scroll to 1234"]);
    expect(scrolls.mock.calls.at(-1)?.[0]).toEqual({ left: 0, top: 1234, behavior: "instant" });
    expect(scrollY).toBe(1234);
    expect(shots.cuts.map((c) => c.region.label)).toEqual(["A", "B", "C"]);
    expect(hidden.slice(1).every((v) => v === "hidden")).toBe(true);
    expect(host.style.visibility).toBe("");
  });

  it("a crop larger than the screen is taken from its top and named as larger", async () => {
    at(0);
    const { marks, now } = page([{ y: 2000, h: 1500 }]);
    const shots = await shoot(document.createElement("div"), marks, now);
    expect(events).toEqual(["scroll to 2000", "capture at 2000", "scroll to 0"]);
    expect(shots.larger).toEqual(["A"]);
    expect(shots.cuts[0]?.region.rect).toEqual({ x: 20, y: 0, w: 300, h: 800 });
  });

  it("puts the scroll back and shows Pointer again when a capture is refused", async () => {
    at(500);
    const { screenshot } = await import("../src/capture/picture");
    vi.mocked(screenshot).mockRejectedValueOnce(new Error("no capture"));
    const { marks, now } = page([{ y: 3000, h: 100 }]);
    const host = document.createElement("div");
    await expect(shoot(host, marks, now)).rejects.toThrow("no capture");
    expect(events.at(-1)).toBe("scroll to 500");
    expect(host.style.visibility).toBe("");
  });
});
