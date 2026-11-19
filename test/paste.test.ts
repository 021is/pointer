import { describe, expect, it } from "vitest";
import { formatStrip } from "../src/bundle/format";
import type { Bundle, PinInfo } from "../src/bundle/types";
import { dragged, gripAt, landing, stepOpacity } from "../src/paste/geometry";
import { CSS } from "../src/ui/css";
import { commandFor } from "../src/ui/keys";
import { afterPaste } from "../src/ui/state";

describe("a paste switches to Move (Edvard, 2026-11-19)", () => {
  it("from Comment: Move, the output kept, the image under the mouse ready to drag", () => {
    expect(afterPaste({ tool: "comment", output: "text" })).toEqual({ tool: "move", output: "text" });
    expect(afterPaste({ tool: "pen", output: "picture" })).toEqual({ tool: "move", output: "picture" });
    const mouse = { x: 500, y: 300 };
    const rect = landing({ w: 400, h: 200 }, 1, mouse, { w: 1440, h: 900 });
    expect(gripAt(rect, mouse)).toBe("move");
  });

  it("Move is a tool where a press reaches a pasted image", () => {
    expect(CSS).toMatch(/\.layer\[data-tool="move"\] \.pimg[^{]*\{ pointer-events: auto/);
  });
});

describe("a pasted image's first box", () => {
  it("is its size in CSS pixels (a 2× screenshot is half), centred on the mouse", () => {
    expect(landing({ w: 800, h: 400 }, 2, { x: 500, y: 300 }, { w: 1440, h: 900 })).toEqual({
      x: 300,
      y: 200,
      w: 400,
      h: 200,
    });
  });

  it("fits in 60% of the viewport, ratio kept", () => {
    const r = landing({ w: 3000, h: 1500 }, 1, { x: 0, y: 0 }, { w: 1000, h: 800 });
    expect([r.w, r.h]).toEqual([600, 300]);
  });
});

describe("moving and resizing", () => {
  const box = { x: 100, y: 100, w: 200, h: 100 };

  it("grabs the corner to resize, the rest to move, nothing outside", () => {
    expect(gripAt(box, { x: 295, y: 195 })).toBe("resize");
    expect(gripAt(box, { x: 150, y: 150 })).toBe("move");
    expect(gripAt(box, { x: 50, y: 50 })).toBeNull();
  });

  it("moves by the drag, resizes keeping the ratio (Shift: free), never below 24px", () => {
    expect(dragged(box, "move", 10, -5, false)).toEqual({ x: 110, y: 95, w: 200, h: 100 });
    expect(dragged(box, "resize", 100, 0, false)).toEqual({ x: 100, y: 100, w: 300, h: 150 });
    expect(dragged(box, "resize", 100, 10, true)).toEqual({ x: 100, y: 100, w: 300, h: 110 });
    expect(dragged(box, "resize", -500, -500, true)).toMatchObject({ w: 24, h: 24 });
  });

  it("steps see-through 100 → 75 → 50 → 25 and back, never past the ends", () => {
    expect(stepOpacity(1, -1)).toBe(0.75);
    expect(stepOpacity(0.5, -1)).toBe(0.25);
    expect(stepOpacity(0.25, -1)).toBe(0.25);
    expect(stepOpacity(0.75, 1)).toBe(1);
    expect(stepOpacity(1, 1)).toBe(1);
  });

  it("[ ] and Delete reach the pasted image under the mouse", () => {
    const key = (k: string) => ({ key: k, ctrlKey: false, metaKey: false, altKey: false });
    expect(commandFor(key("["), "page")).toEqual({ type: "see", direction: -1 });
    expect(commandFor(key("]"), "pick")).toEqual({ type: "see", direction: 1 });
    expect(commandFor(key("Delete"), "pen")).toEqual({ type: "remove" });
  });
});

describe("formatStrip without a picture", () => {
  it("drops shapes and pasted images, keeps words typed on the page", () => {
    const b: Bundle = {
      url: "https://x.dev/",
      viewport: { w: 1, h: 1 },
      crops: [],
      pins: [],
      drawings: { arrows: 2, boxes: 1, ellipses: 0, pens: 0, texts: ["blue"], pasted: 1 },
      image: null,
    };
    expect(formatStrip(b, false).split("\n").slice(1)).toEqual(['drawn: text "blue"']);
    expect(formatStrip(b, true)).toContain("2 arrows");
  });
});

describe("formatStrip: the compact lines under the picture", () => {
  const pin = (n: number, over: Partial<Pick<PinInfo, "changes" | "note" | "component">> = {}): PinInfo => ({
    n,
    kind: "pick",
    component: {
      framework: "react",
      chain: ["IconLine", "EventCard"],
      where: {
        kind: "found",
        source: { file: "src/feature/dance/list/ui/EventCard.tsx", line: 190 },
        usedAt: { file: "src/feature/dance/list/ui/EventRows.tsx", line: 32 },
      },
    },
    el: { selector: "span.truncate", tag: "span", text: "Nov 13 – 22", size: { w: 74, h: 20 }, style: "font 14px" },
    changes: [],
    note: "",
    ...over,
  });
  const bundle: Bundle = {
    url: "https://app.example.com/dance",
    viewport: { w: 1440, h: 788 },
    crops: [],
    pins: [
      pin(7, { changes: ["gap 6px → 8px", "font-style normal → italic"], note: "make it lighter" }),
      pin(8),
      pin(9, { component: { framework: "react", chain: [], where: { kind: "unknown", why: "prod" } } }),
    ],
    drawings: { arrows: 0, boxes: 0, ellipses: 0, pens: 0, texts: [], pasted: 0 },
    image: null,
  };

  it("keeps who, where, the changes and the note; no selector, style or class when the file is known", () => {
    expect(formatStrip(bundle, false).split("\n")).toEqual([
      "Pointer · https://app.example.com/dance · viewport 1440×788 · react",
      'Task: the user marked these elements on this page. For each [n]: open the file at that line ((in X) = where that component is used), do what its note says, and turn "changed" (the user\'s live CSS edits) into code. Then answer per [n] what you did.',
      '[7] pick · IconLine "Nov 13 – 22" · src/feature/dance/list/ui/EventCard.tsx:190 (in EventRows.tsx:32)',
      "   changed: gap 6px → 8px; font-style normal → italic",
      "   note: make it lighter",
      '[8] pick · IconLine "Nov 13 – 22" · src/feature/dance/list/ui/EventCard.tsx:190 (in EventRows.tsx:32)',
      '[9] pick · span "Nov 13 – 22" · span.truncate',
    ]);
  });
});
