import { describe, expect, it } from "vitest";
import { changeLines, groupProps, noEdits, nudge, parseDeclaration, withProp } from "../src/panel/edits";
import { isUniversal } from "../src/panel/rules";

describe("changeLines: the diff the agent reads", () => {
  it("writes set, removed, classes and inserts, and skips a value set back to what it was", () => {
    let e = withProp(noEdits(), "font-size", "15px", "17px");
    e = withProp(e, "box-shadow", "0 1px 3px #000", null);
    e = withProp(e, "color", "#1a1a2e", "#1a1a2e");
    e = {
      ...e,
      removedClasses: ["shadow-sm", "p-4"],
      addedClasses: [
        { name: "gap-6", built: true },
        { name: "gap-[13px]", built: false },
      ],
      inserted: [{ position: "after", label: "Map", size: { w: 240, h: 48 } }],
    };
    expect(changeLines(e)).toEqual([
      "font-size 15px → 17px",
      "removed box-shadow (was 0 1px 3px #000)",
      "removed class: shadow-sm p-4",
      "added class: gap-6",
      "added class: gap-[13px] (not built yet)",
      'inserted after it: placeholder "Map" (240×48)',
    ]);
  });

  it("keeps the first before across edits of the same property", () => {
    let e = withProp(noEdits(), "gap", "8px", "12px");
    e = withProp(e, "gap", "12px", "16px");
    expect(e.props).toEqual([{ prop: "gap", before: "8px", after: "16px" }]);
  });
});

describe("nudge (↑/↓ in a value)", () => {
  it("moves the first number and keeps its unit and the rest", () => {
    expect(nudge("16px 24px", 1)).toBe("17px 24px");
    expect(nudge("1.5rem", 0.1)).toBe("1.6rem");
    expect(nudge("-2px", -10)).toBe("-12px");
    expect(nudge("0.875", 1)).toBe("1.875");
  });

  it("leaves a value without numbers alone", () => {
    expect(nudge("auto", 1)).toBeNull();
  });
});

describe("groupProps", () => {
  it("folds longhands, logical ones too, into what people write; drops custom properties", () => {
    expect(
      groupProps([
        "--tw-shadow",
        "padding-inline-start",
        "padding-inline-end",
        "border-top-left-radius",
        "border-start-end-radius",
        "border-bottom-width",
        "row-gap",
        "column-gap",
        "font-size",
        "transition-duration",
        "overflow-x",
      ]),
    ).toEqual(["padding", "border-radius", "border", "gap", "font-size", "transition", "overflow"]);
  });
});

describe("isUniversal: resets that hit every element stay out of the list", () => {
  it("drops *, ::before, :root and html resets, keeps anything naming the element", () => {
    expect(isUniversal("*, ::after, ::before, ::backdrop")).toBe(true);
    expect(isUniversal(":root, :host")).toBe(true);
    expect(isUniversal("::file-selector-button")).toBe(true);
    expect(isUniversal("h1, h2, h3")).toBe(false);
    expect(isUniversal(".lg\\:text-8xl")).toBe(false);
    expect(isUniversal("*, h1")).toBe(false);
  });
});

describe("parseDeclaration (+ add)", () => {
  it("reads 'prop: value', 'prop value' and a trailing semicolon", () => {
    expect(parseDeclaration("gap: 12px")).toEqual(["gap", "12px"]);
    expect(parseDeclaration("Margin-Top 4px;")).toEqual(["margin-top", "4px"]);
    expect(parseDeclaration("box-shadow: 0 1px 2px rgb(0 0 0 / .2)")).toEqual(["box-shadow", "0 1px 2px rgb(0 0 0 / .2)"]);
  });

  it("refuses a property with no value", () => {
    expect(parseDeclaration("gap")).toBeNull();
  });
});
