import { describe, expect, it } from "vitest";
import {
  cropFor,
  dragRect,
  imageTokens,
  intersect,
  outputSize,
  snapLine,
  toImagePixels,
  union,
} from "../src/shared/geometry";

describe("snapLine (Shift on a line or arrow)", () => {
  const o = { x: 100, y: 100 };

  it("snaps a near-horizontal drag flat, keeping the cursor's x", () => {
    expect(snapLine(o, { x: 160, y: 108 })).toEqual({ x: 160, y: 100 });
  });

  it("snaps a near-vertical drag upright, also upward", () => {
    expect(snapLine(o, { x: 96, y: 20 })).toEqual({ x: 100, y: 20 });
  });

  it("snaps to 45° at the cursor's projection on the diagonal", () => {
    expect(snapLine(o, { x: 110, y: 109 })).toEqual({ x: 109.5, y: 109.5 });
  });

  it("snaps the other diagonals too", () => {
    expect(snapLine(o, { x: 90, y: 110 })).toEqual({ x: 90, y: 110 });
    expect(snapLine(o, { x: 50, y: 52 })).toEqual({ x: 51, y: 51 });
  });

  it("leaves a zero-length drag where it is", () => {
    expect(snapLine(o, o)).toEqual(o);
  });
});

describe("dragRect (box and ellipse)", () => {
  it("normalizes a drag up and to the left", () => {
    expect(dragRect({ x: 50, y: 40 }, { x: 10, y: 10 }, false)).toEqual({ x: 10, y: 10, w: 40, h: 30 });
  });

  it("Shift makes it square on the longer side, toward the cursor", () => {
    expect(dragRect({ x: 50, y: 50 }, { x: 80, y: 60 }, true)).toEqual({ x: 50, y: 50, w: 30, h: 30 });
    expect(dragRect({ x: 50, y: 50 }, { x: 40, y: 10 }, true)).toEqual({ x: 10, y: 10, w: 40, h: 40 });
  });
});

describe("the picture's crop", () => {
  const viewport = { w: 1280, h: 800 };

  it("holds every mark plus the margin", () => {
    const crop = cropFor(
      [
        { x: 100, y: 100, w: 50, h: 50 },
        { x: 300, y: 200, w: 20, h: 20 },
      ],
      viewport,
    );
    expect(crop).toEqual({ x: 76, y: 76, w: 268, h: 168 });
  });

  it("stays inside the viewport", () => {
    expect(cropFor([{ x: -40, y: 780, w: 100, h: 100 }], viewport)).toEqual({ x: 0, y: 756, w: 84, h: 44 });
  });

  it("is null when nothing is on screen or nothing is marked", () => {
    expect(cropFor([], viewport)).toBeNull();
    expect(cropFor([{ x: 2000, y: 2000, w: 10, h: 10 }], viewport)).toBeNull();
  });

  it("union and intersect agree on edges", () => {
    expect(union([])).toBeNull();
    expect(intersect({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 5, h: 5 })).toBeNull();
  });
});

describe("toImagePixels (CSS pixels → screenshot pixels)", () => {
  it("doubles on a 2× Retina screen", () => {
    expect(toImagePixels({ x: 10, y: 20, w: 100, h: 50 }, 2, { w: 2560, h: 1600 })).toEqual({
      x: 20,
      y: 40,
      w: 200,
      h: 100,
    });
  });

  it("covers fractional pixels at 1.5× (Windows 150%)", () => {
    expect(toImagePixels({ x: 11, y: 11, w: 11, h: 11 }, 1.5, { w: 1920, h: 1200 })).toEqual({
      x: 16,
      y: 16,
      w: 17,
      h: 17,
    });
  });

  it("never reads outside the image", () => {
    expect(toImagePixels({ x: 1270, y: 790, w: 50, h: 50 }, 2, { w: 2560, h: 1600 })).toEqual({
      x: 2540,
      y: 1580,
      w: 20,
      h: 20,
    });
  });
});

describe("outputSize and tokens", () => {
  it("keeps one pixel per CSS pixel when small", () => {
    expect(outputSize({ w: 640, h: 380 })).toEqual({ w: 640, h: 380 });
  });

  it("caps the long edge at 1000", () => {
    expect(outputSize({ w: 1280, h: 800 })).toEqual({ w: 1000, h: 625 });
  });

  it("prices an image like Claude does (w×h/750)", () => {
    expect(imageTokens({ w: 640, h: 380 })).toBe(325);
    expect(imageTokens({ w: 2560, h: 1600 })).toBe(5462);
  });
});
