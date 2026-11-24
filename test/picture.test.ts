// @vitest-environment happy-dom
// The picture from several screenshots (crops captured at different scrolls, capture/shots.ts):
// each cut is drawn from its own screenshot, its part brought from device to CSS pixels, stacked
// in order with its letter tab band above it, and its own marks drawn over it. The canvas records
// what is drawn; the images decode at once.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stackRegions } from "../src/capture/layout";
import { picture } from "../src/capture/picture";
import type { Cut } from "../src/capture/shots";
import type { Scene } from "../src/marks/svg";

type Draw = { img: unknown; args: number[] };
let draws: Draw[];

beforeEach(() => {
  draws = [];
  window.happyDOM.setViewport({ width: 400, height: 800 });
  const ctx = {
    font: "",
    fillStyle: "",
    textBaseline: "",
    imageSmoothingQuality: "",
    globalAlpha: 1,
    measureText: () => ({ width: 8.4 }),
    fillRect: () => {},
    fillText: () => {},
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    rect: () => {},
    clip: () => {},
    drawImage: (img: unknown, ...args: number[]) => draws.push({ img, args }),
  };
  // happy-dom has no 2D canvas: a recorder stands in for the methods picture() calls.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as never);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((done: BlobCallback) => done(new Blob(["png"])));
  vi.stubGlobal(
    "Image",
    class {
      src = "";
      decode = async () => {};
    },
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const scene: Scene = { pins: [], shapes: [], frames: [] };
/** A 2× screenshot of a 400×800 viewport, named so the test can tell them apart. */
function shot(name: string): HTMLImageElement {
  const img = document.createElement("img");
  img.alt = name;
  Object.defineProperty(img, "naturalWidth", { value: 800 });
  Object.defineProperty(img, "naturalHeight", { value: 1600 });
  return img;
}

describe("picture from several screenshots", () => {
  it("draws each cut from its own screenshot at CSS-pixel size, stacked in order under its tab, its marks over it", async () => {
    const a: Cut = { shot: shot("first stop"), region: { label: "A", rect: { x: 10, y: 20, w: 100, h: 50 } }, scene, pasted: [] };
    const b: Cut = { shot: shot("second stop"), region: { label: "B", rect: { x: 0, y: 300, w: 200, h: 100 } }, scene, pasted: [] };
    const { size } = await picture([a, b], null);

    const stack = stackRegions([a.region, b.region], null);
    expect(size).toEqual({ w: stack.width, h: stack.height });
    const [pa, pb] = stack.placed;
    if (!pa || !pb) throw new Error("two regions placed");
    // Per cut: its screenshot's part, then its marks (an SVG image) over it, tab band included.
    expect(draws).toHaveLength(4);
    expect(draws[0]).toEqual({ img: a.shot, args: [20, 40, 200, 100, 0, pa.top, 100, 50] });
    expect(draws[1]?.args).toEqual([0, pa.top - pa.tab, 100, 50 + pa.tab]);
    expect(draws[2]).toEqual({ img: b.shot, args: [0, 600, 400, 200, 0, pb.top, 200, 100] });
    expect(draws[3]?.args).toEqual([0, pb.top - pb.tab, 200, 100 + pb.tab]);
    expect(pb.top).toBeGreaterThan(pa.top + 50);
  });
});
