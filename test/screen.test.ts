// The Screen tool's rules (Edvard, 2026-11-23): Full, Tablet 768 × 1024, Mobile 390 × 844 and a
// Custom size of 240 to 3840 px a side, typed and checked; the custom size read back from storage
// is checked too; the framed page fits between the label and the bar; points map both ways.
import { describe, expect, it } from "vitest";
import {
  MOBILE,
  TABLET,
  checkCustom,
  clientToView,
  placeFrame,
  readSaved,
  rectToClient,
  sameScreen,
  screenLabel,
  sizeOf,
  viewToClient,
} from "../src/screen/sizes";

describe("the screens", () => {
  it("are Full, Tablet, Mobile and Custom, each with its size and label", () => {
    expect(sizeOf({ kind: "tablet" })).toEqual({ w: 768, h: 1024 });
    expect(sizeOf({ kind: "mobile" })).toEqual({ w: 390, h: 844 });
    expect(sizeOf({ kind: "custom", size: { w: 1280, h: 720 } })).toEqual({ w: 1280, h: 720 });
    expect(screenLabel({ kind: "mobile" })).toBe("Mobile · 390 × 844");
    expect(screenLabel({ kind: "tablet" })).toBe("Tablet · 768 × 1024");
    expect(screenLabel({ kind: "custom", size: { w: 1280, h: 720 } })).toBe("Custom · 1280 × 720");
    expect(screenLabel({ kind: "full" })).toBe("Full: the page as it is");
  });

  it("a custom size is the same choice only at the same size", () => {
    expect(sameScreen({ kind: "mobile" }, { kind: "mobile" })).toBe(true);
    expect(sameScreen({ kind: "custom", size: { w: 800, h: 600 } }, { kind: "custom", size: { w: 800, h: 600 } })).toBe(true);
    expect(sameScreen({ kind: "custom", size: { w: 800, h: 600 } }, { kind: "custom", size: { w: 801, h: 600 } })).toBe(false);
    expect(sameScreen({ kind: "full" }, { kind: "tablet" })).toBe(false);
  });
});

describe("the custom size, as typed", () => {
  it("takes whole pixels from 240 to 3840 a side, spaces around them allowed", () => {
    expect(checkCustom("1280", " 720 ")).toEqual({ ok: true, size: { w: 1280, h: 720 } });
    expect(checkCustom("240", "3840")).toEqual({ ok: true, size: { w: 240, h: 3840 } });
  });

  it.each([
    ["239", "800", "Width: between 240 and 3840 pixels."],
    ["800", "3841", "Height: between 240 and 3840 pixels."],
    ["", "800", "Width: type a whole number of pixels, like 1280."],
    ["800", "12.5", "Height: type a whole number of pixels, like 720."],
    ["-400", "800", "Width: type a whole number of pixels, like 1280."],
    ["1e3", "800", "Width: type a whole number of pixels, like 1280."],
  ])("refuses %j × %j and says why", (w, h, why) => {
    expect(checkCustom(w, h)).toEqual({ ok: false, why });
  });
});

describe("the saved custom size, read back from storage", () => {
  it("is a size within the limits, or nothing", () => {
    expect(readSaved({ w: 1280, h: 720 })).toEqual({ w: 1280, h: 720 });
    expect(readSaved({ w: 1280, h: 720, extra: "<script>" })).toEqual({ w: 1280, h: 720 });
    for (const junk of [null, "1280x720", { w: "1280", h: 720 }, { w: 100, h: 720 }, { w: 1280.5, h: 720 }, { w: 1280 }]) {
      expect(readSaved(junk)).toBeNull();
    }
  });
});

describe("where the framed page sits on the tab", () => {
  it("at its own size when it fits, centred between the label and the bar", () => {
    expect(placeFrame(MOBILE, { w: 1440, h: 1100 })).toEqual({ x: 525, y: 102, scale: 1 });
  });

  it("shrunk to fit a short window, never grown", () => {
    const at = placeFrame(MOBILE, { w: 1280, h: 800 });
    expect(at.scale).toBeCloseTo(660 / 844, 6);
    expect(at.y).toBe(44);
    expect(placeFrame(TABLET, { w: 600, h: 2000 }).scale).toBeCloseTo(552 / 768, 6);
  });

  it("maps a point and a rect between the tab and the framed page, both ways", () => {
    const box = { x: 500, y: 44, scale: 0.5 };
    expect(clientToView(box, { x: 600, y: 144 })).toEqual({ x: 200, y: 200 });
    expect(viewToClient(box, { x: 200, y: 200 })).toEqual({ x: 600, y: 144 });
    expect(rectToClient(box, { x: 0, y: 100, w: 390, h: 200 })).toEqual({ x: 500, y: 94, w: 195, h: 100 });
    const tab = { x: 0, y: 0, scale: 1 };
    expect(clientToView(tab, { x: 12, y: 34 })).toEqual({ x: 12, y: 34 });
  });
});
