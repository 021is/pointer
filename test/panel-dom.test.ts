// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { edit } from "../src/panel/element";
import { knownClasses, matchedProps } from "../src/panel/rules";
import { renderPanel } from "../src/panel/view";

const card = () => {
  const el = document.querySelector<HTMLElement>(".card");
  if (!el) throw new Error("no .card in the fixture");
  return el;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  document.head.innerHTML = `<style>
    * { box-sizing: border-box; }
    .card { padding: 16px; color: rgb(26, 26, 46); }
    .other { margin: 4px; }
    @media (min-width: 99999px) { .wide\\:p-8 { padding: 32px; } .card { gap: 9px; } }
  </style>`;
  document.body.innerHTML = `<main><div class="card shadow" style="opacity: 0.9">Hi</div><p>after</p></main>`;
});

describe("matchedProps: the CSS that reaches the element", () => {
  it("lists its own rules and inline style, not universal resets or other elements' rules", () => {
    const { props } = matchedProps(card());
    expect(props.get("color")).toBe(".card");
    expect(props.get("opacity")).toBe("inline");
    expect([...props.keys()].some((p) => p.startsWith("padding"))).toBe(true);
    expect(props.has("box-sizing")).toBe(false);
    expect(props.has("margin")).toBe(false);
  });

  it("leaves out an @media rule that does not apply at this width", () => {
    expect(matchedProps(card()).props.has("gap")).toBe(false);
  });
});

describe("knownClasses", () => {
  it("knows classes from every rule, @media at any width included", () => {
    const known = knownClasses();
    expect(known.has("card")).toBe(true);
    expect(known.has("wide:p-8")).toBe(true);
    expect(known.has("never-used")).toBe(false);
  });
});

describe("the panel's value field", () => {
  it("Escape cancels: the blur's change event writes no edit and no inline style", () => {
    const e = edit(card());
    const panel = document.createElement("div");
    document.body.append(panel);
    renderPanel(panel, 1, e, null, { changed: () => {}, close: () => {} });
    const row = panel.querySelector<HTMLElement>('.row[data-prop="color"]');
    const value = row?.querySelector<HTMLInputElement>(".val");
    if (!value) throw new Error("no color row");
    value.value = "red";
    value.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    value.dispatchEvent(new Event("change"));
    expect(e.edits.props).toEqual([]);
    expect(card().style.getPropertyValue("color")).toBe("");
  });

  it("Enter applies the typed value", () => {
    const e = edit(card());
    const panel = document.createElement("div");
    renderPanel(panel, 1, e, null, { changed: () => {}, close: () => {} });
    const value = panel.querySelector<HTMLInputElement>('.row[data-prop="color"] .val');
    if (!value) throw new Error("no color row");
    value.value = "red";
    value.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(e.edits.props[0]?.change).toEqual({ kind: "set", value: "red" });
  });
});

describe("edit: live changes on one element, and their diff", () => {
  it("sets a value and writes the diff against the first value seen", () => {
    const e = edit(card());
    expect(e.set("color", "rgb(91, 61, 245)")).toBeNull();
    expect(card().style.getPropertyValue("color")).toBe("rgb(91, 61, 245)");
    expect(e.lines()[0]).toMatch(/^color .+ → rgb\(91, 61, 245\)$/);
  });

  it("refuses an empty or invalid value, says why and records nothing", () => {
    // happy-dom accepts any value; Chrome's CSS.supports refuses this one.
    vi.stubGlobal("CSS", { supports: (_prop: string, value?: string) => value !== "not-a-colour" });
    const e = edit(card());
    expect(e.set("color", "")).toMatch(/type a value/);
    expect(e.set("color", "not-a-colour")).toMatch(/not valid CSS/);
    expect(e.lines()).toEqual([]);
  });

  it("off and remove both read 'removed'; on drops the edit and restores the own inline value", () => {
    const e = edit(card());
    e.off("opacity");
    expect(card().style.getPropertyValue("opacity")).toBe("unset");
    expect(e.lines()[0]).toMatch(/^removed opacity/);
    e.on("opacity");
    expect(card().style.getPropertyValue("opacity")).toBe("0.9");
    expect(e.lines()).toEqual([]);
    e.remove("color");
    expect(e.edits.props[0]?.change).toEqual({ kind: "removed" });
  });

  it("tracks classes and placeholders, and reset puts everything back", () => {
    const e = edit(card());
    e.removeClass("shadow");
    e.addClass("never-used");
    const box = e.insert("after");
    box.textContent = "Map";
    expect(e.lines()).toEqual([
      "removed class: shadow",
      "added class: never-used (not built yet)",
      expect.stringMatching(/^inserted after it: placeholder "Map"/),
    ]);
    e.set("color", "red");
    e.reset();
    expect(card().getAttribute("class")).toBe("card shadow");
    expect(card().getAttribute("style")).toBe("opacity: 0.9");
    expect(card().nextElementSibling?.tagName).toBe("P");
    expect(e.lines()).toEqual([]);
  });

  it("a snapshot taken before a reset brings every edit back (Undo after Clear everything)", () => {
    const e = edit(card());
    e.set("color", "red");
    e.removeClass("shadow");
    const box = e.insert("after");
    box.textContent = "Map";
    const before = e.lines();
    const snap = e.snapshot();
    e.reset();
    expect(e.lines()).toEqual([]);
    e.restore(snap);
    expect(e.lines()).toEqual(before);
    expect(card().style.getPropertyValue("color")).toBe("red");
    expect(card().classList.contains("shadow")).toBe(false);
    expect(card().nextElementSibling?.textContent).toBe("Map");
  });
});
