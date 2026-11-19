// @vitest-environment happy-dom
// The icon picker (Edvard, 2026-11-19): search Lucide by name and tags, place by click (the last
// point, else the middle of the view) or by drop, move and resize, kept through a reload, and the
// output line "[6] icon: lucide calendar-heart on EventCard (EventCard.tsx:27)".
import { describe, expect, it } from "vitest";
import { formatStrip } from "../src/bundle/format";
import type { Bundle, PinInfo } from "../src/bundle/types";
import { dragged, iconAt } from "../src/icons/icons";
import { type LucideData, placeAt, searchIcons } from "../src/icons/search";
import { fromSaved, toSaved } from "../src/keep/saved";
import type { Mark } from "../src/marks/types";

const data: LucideData = {
  version: "0.503.0",
  svg: { "calendar-heart": "<path/>", calendar: "<path/>", heart: "<path/>", "heart-crack": "<path/>", bell: "<path/>" },
  tags: { "calendar-heart": ["date", "love", "wedding"], calendar: ["date", "month"], heart: ["like", "love"], "heart-crack": ["break up"], bell: ["alarm", "notification"] },
};

describe("search", () => {
  it("by name: exact first, then starts-with, then a word of the name", () => {
    expect(searchIcons(data, "heart")).toEqual(["heart", "heart-crack", "calendar-heart"]);
    expect(searchIcons(data, "calendar")).toEqual(["calendar", "calendar-heart"]);
  });

  it("by tags, every word matching, as typed", () => {
    expect(searchIcons(data, "love")).toEqual(["heart", "calendar-heart"]);
    expect(searchIcons(data, "date love")).toEqual(["calendar-heart"]);
    expect(searchIcons(data, "notif")).toEqual(["bell"]);
    expect(searchIcons(data, "zzz")).toEqual([]);
    expect(searchIcons(data, "", 2)).toEqual(["calendar-heart", "calendar"]);
  });
});

describe("placing", () => {
  const view = { w: 1000, h: 800 };
  it("a click: centred on the last point, else on the middle of the view", () => {
    expect(placeAt(32, { x: 300, y: 400 }, view, { x: 0, y: 100 })).toEqual({ x: 284, y: 384 });
    expect(placeAt(32, null, view, { x: 0, y: 100 })).toEqual({ x: 484, y: 484 });
  });

  it("a drop: centred where it was let go", () => {
    expect(placeAt(32, { x: 116, y: 216 }, view, { x: 0, y: 0 })).toEqual({ x: 100, y: 200 });
  });

  it("a drag moves it; from its bottom-right corner it resizes, square, never below 12 px", () => {
    const start = { at: { x: 100, y: 100 }, size: 32 };
    expect(dragged(start, { x: 110, y: 110 }, { x: 150, y: 120 })).toEqual({ at: { x: 140, y: 110 }, size: 32 });
    expect(dragged(start, { x: 130, y: 130 }, { x: 150, y: 140 })).toEqual({ at: { x: 100, y: 100 }, size: 52 });
    expect(dragged(start, { x: 130, y: 130 }, { x: 0, y: 0 }).size).toBe(12);
  });

  it("is found under the mouse for a drag or Delete, and survives a reload", () => {
    const icon: Mark = { kind: "icon", color: "red", el: document.body, at: { x: 100, y: 100 }, note: "", name: "bell", svg: "<path/>", size: 32 };
    expect(iconAt([icon], { x: 120, y: 120 })).toBe(icon);
    expect(iconAt([icon], { x: 90, y: 90 })).toBeUndefined();
    const t = { selector: "body", tag: "BODY", label: "body" };
    const { saved } = toSaved([icon], { target: () => t, editsOf: () => null, imageSrc: () => null });
    const back = fromSaved(JSON.parse(JSON.stringify(saved)), { find: () => null, at: () => null, image: () => new Image(), page: document.body });
    expect(back.marks[0]).toMatchObject({ kind: "icon", name: "bell", size: 32, el: document.body });
    expect(back.lost).toEqual([]);
  });
});

describe("the output line", () => {
  it("names the icon and the element it lies on, with its file:line", () => {
    const pin: PinInfo = {
      n: 6,
      kind: "icon",
      name: "calendar-heart",
      component: { framework: "react", chain: ["EventCard"], where: { kind: "found", source: { file: "src/EventCard.tsx", line: 27 } } },
      el: { selector: "div.card", tag: "div", size: { w: 300, h: 200 } },
      changes: [],
      note: "",
    };
    const b: Bundle = { url: "http://localhost:3300/", viewport: { w: 1, h: 1 }, crops: [], pins: [pin], shapeNotes: [], drawings: { arrows: 0, boxes: 0, ellipses: 0, pens: 0, texts: [], pasted: 0 }, image: null };
    expect(formatStrip(b, true).split("\n").at(-1)).toBe("[6] icon: lucide calendar-heart on EventCard (src/EventCard.tsx:27)");
  });
});
