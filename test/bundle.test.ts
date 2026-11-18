import { describe, expect, it } from "vitest";
import { clip, formatBundle, formatDrawings } from "../src/bundle/format";
import { firstFamily, keyStyles, toHex } from "../src/bundle/key-styles";
import type { Bundle, PinInfo } from "../src/bundle/types";

const pick: PinInfo = {
  n: 1,
  kind: "pick",
  component: {
    framework: "react",
    chain: ["ProfileCard", "EventList", "EventsPage"],
    where: { kind: "found", source: { file: "src/feature/profile/ProfileCard.tsx", line: 24 } },
  },
  el: {
    selector: "div.card",
    tag: "div",
    text: "Anna  Müller\n · 3 events",
    className: "flex p-4 rounded-xl",
    size: { w: 320, h: 180 },
    style: "font 15px/21px Inter 600 · color #1a1a2e",
  },
  changes: ["font-size 15px → 17px", "color #1a1a2e → #5b3df5"],
  note: "more air above the name ",
};

const comment: PinInfo = {
  n: 2,
  kind: "comment",
  component: {
    framework: "react",
    chain: ["JoinButton"],
    where: { kind: "unknown", why: "no source map for page.js" },
  },
  el: { selector: "button.btn", tag: "button", text: "Join event", className: "btn w-auto", size: { w: 96, h: 40 } },
  changes: [],
  note: "full width on mobile",
};

const bundle: Bundle = {
  url: "https://live.danceclub.dev/events/42",
  viewport: { w: 1280, h: 800 },
  crops: [],
  pins: [pick, comment],
  drawings: { arrows: 1, boxes: 2, ellipses: 0, pens: 0, texts: ["bigger"], pasted: 0 },
  image: { w: 640, h: 380 },
};

describe("formatBundle", () => {
  it("writes the few lines the agent needs, in order", () => {
    expect(formatBundle(bundle)).toBe(
      [
        "Pointer · https://live.danceclub.dev/events/42 · viewport 1280×800 · react",
        "image: 640×380 (≈325 tokens), numbers on it match [n] below",
        'drawn: 1 arrow, 2 boxes, text "bigger"',
        "[1] pick · ProfileCard ← EventList ← EventsPage",
        "   file: src/feature/profile/ProfileCard.tsx:24",
        '   el: div.card "Anna Müller · 3 events" · 320×180',
        "   style: font 15px/21px Inter 600 · color #1a1a2e",
        "   changed: font-size 15px → 17px",
        "            color #1a1a2e → #5b3df5",
        "   note: more air above the name",
        "[2] comment · JoinButton",
        "   file: unknown (no source map for page.js)",
        '   el: button.btn "Join event" · 96×40',
        '   class: "btn w-auto"',
        "   note: full width on mobile",
      ].join("\n"),
    );
  });

  it("is text only, with no image or drawing lines, for a plain pick", () => {
    const text = formatBundle({ ...bundle, pins: [pick], image: null, drawings: { arrows: 0, boxes: 0, ellipses: 0, pens: 0, texts: [], pasted: 0 } });
    expect(text).not.toContain("image:");
    expect(text).not.toContain("drawn:");
    expect(text.split("\n")).toHaveLength(8);
  });

  it("names no framework when the page has none and falls back to the tag", () => {
    const plain: PinInfo = { ...comment, component: { framework: "none", chain: [], where: { kind: "silent" } } };
    const text = formatBundle({ ...bundle, pins: [plain], image: null });
    expect(text.split("\n")[0]).toBe("Pointer · https://live.danceclub.dev/events/42 · viewport 1280×800");
    expect(text).toContain("[2] comment · button");
    expect(text).not.toContain("file:");
  });

  it("says where a shared component is used", () => {
    const button: PinInfo = {
      ...comment,
      component: {
        framework: "react",
        chain: ["Button", "FullScreenMenu"],
        where: {
          kind: "found",
          source: { file: "src/components/ui/button.tsx", line: 52 },
          usedAt: { file: "src/feature/site/menu/FullScreenMenu.tsx", line: 40 },
        },
      },
    };
    const lines = formatBundle({ ...bundle, pins: [button], image: null }).split("\n");
    expect(lines.slice(3, 5)).toEqual([
      "   file: src/components/ui/button.tsx:52",
      "   used at: src/feature/site/menu/FullScreenMenu.tsx:40",
    ]);
  });

  it("clips long text with an ellipsis", () => {
    expect(clip("a".repeat(100), 10)).toBe(`${"a".repeat(9)}…`);
    expect(formatDrawings({ arrows: 0, boxes: 1, ellipses: 2, pens: 1, texts: [], pasted: 0 })).toBe(
      "drawn: 1 box, 2 ellipses, 1 pen stroke",
    );
    expect(formatDrawings({ arrows: 0, boxes: 0, ellipses: 0, pens: 0, texts: [], pasted: 2 })).toBe(
      "drawn: 2 pasted images (a reference laid on the page, not the page)",
    );
  });
});

describe("keyStyles", () => {
  it("writes the look in one line and leaves defaults out", () => {
    expect(
      keyStyles({
        display: "flex",
        "font-size": "15px",
        "line-height": "21px",
        "font-family": '"Inter", system-ui, sans-serif',
        "font-weight": "600",
        color: "rgb(26, 26, 46)",
        "background-color": "rgba(0, 0, 0, 0)",
        padding: "16px 24px",
        margin: "0px",
        gap: "normal",
        "border-radius": "12px",
        border: "0px none rgb(26, 26, 46)",
      }),
    ).toBe("flex · font 15px/21px Inter 600 · color #1a1a2e · padding 16px 24px · radius 12px");
  });

  it("keeps a red background (its hex ends in 00 but it is not transparent)", () => {
    expect(keyStyles({ "background-color": "rgb(255, 0, 0)" })).toBe("bg #ff0000");
  });

  it("converts colours and families", () => {
    expect(toHex("rgba(91, 61, 245, 0.5)")).toBe("#5b3df580");
    expect(toHex("color-mix(in srgb, red, blue)")).toBe("color-mix(in srgb, red, blue)");
    expect(firstFamily("'Geist Sans', Arial")).toBe("Geist Sans");
  });
});
