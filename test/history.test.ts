// Undo, Redo and Clear everything (Edvard, 2026-11-19: "I couldn't redo what I undo"): marks and
// the picks' CSS edits come back in order, and a new mark after an Undo empties Redo.
import { describe, expect, it } from "vitest";
import type { Mark, Pin } from "../src/marks/types";
import type { Extension } from "../src/ui/extension";
import { createHistory } from "../src/ui/history";
import { commandFor } from "../src/ui/keys";
import { initialState } from "../src/ui/state";
import type { ToastAction } from "../src/ui/toast";

const el = {} as Element;
const pick = (note: string): Pin => ({ kind: "pick", color: "red", el, at: { x: 0, y: 0 }, note });
const box = (x: number): Mark => ({ kind: "box", color: "red", rect: { x, y: 0, w: 10, h: 10 } });

/** A panel stand-in: each pick's CSS edit, taken away by park and given back by its restore. */
function setup() {
  const state = initialState();
  const edits = new Map<Pin, string>();
  const said: { message: string; action?: ToastAction }[] = [];
  const hooks: Extension = {
    changesOf: (p) => (edits.has(p) ? [edits.get(p) as string] : []),
    onPick: () => {},
    onRemove: (p) => edits.delete(p),
    park(pins) {
      const kept = pins.flatMap((p) => (edits.has(p) ? [[p, edits.get(p) as string] as const] : []));
      for (const p of pins) edits.delete(p);
      return () => {
        for (const [p, e] of kept) edits.set(p, e);
      };
    },
    togglePanel: () => "no-pick",
    panelFor: () => null,
    editsOf: () => null,
    replay: () => {},
  };
  const h = createHistory({ state, hooks: () => hooks, update: (c) => c(), say: (message, _k, action) => said.push({ message, action }) });
  return { state, edits, said, h };
}

describe("Undo and Redo", () => {
  it("undo → redo puts back the marks and the pick's CSS edits, in order", () => {
    const { state, edits, h } = setup();
    const p = pick("");
    const b = box(1);
    state.marks.push(p, b);
    edits.set(p, "font-size 14px → 18px");
    h.undo();
    h.undo();
    expect(state.marks).toEqual([]);
    expect(edits.size).toBe(0);
    h.redo();
    expect(state.marks).toEqual([p]);
    expect(edits.get(p)).toBe("font-size 14px → 18px");
    h.redo();
    expect(state.marks).toEqual([p, b]);
  });

  it("a new mark after an undo empties Redo, and Redo says so", () => {
    const { state, said, h } = setup();
    state.marks.push(box(1));
    h.undo();
    state.marks.push(box(2));
    h.redo();
    expect(state.marks).toHaveLength(1);
    expect(said.at(-1)?.message).toMatch(/^Nothing to redo/);
  });

  it("clear everything → undo → redo, by key and from the message", () => {
    const { state, edits, said, h } = setup();
    const p = pick("bigger");
    state.marks.push(p, box(1));
    edits.set(p, "gap 8px → 12px");
    h.clear("Cleared everything.");
    expect(state.marks).toEqual([]);
    expect(edits.size).toBe(0);
    expect(said.at(-1)?.action?.label).toBe("Undo");
    h.undo();
    expect(state.marks).toHaveLength(2);
    expect(edits.get(p)).toBe("gap 8px → 12px");
    expect(said.at(-1)?.action?.label).toBe("Redo");
    said.at(-1)?.action?.run();
    expect(state.marks).toEqual([]);
    expect(edits.size).toBe(0);
    said.at(-1)?.action?.run();
    expect(state.marks).toHaveLength(2);
  });
});

describe("Redo's keys", () => {
  const key = (k: string, mods: { ctrl?: boolean; meta?: boolean; shift?: boolean }) => ({
    key: k,
    ctrlKey: mods.ctrl ?? false,
    metaKey: mods.meta ?? false,
    altKey: false,
    shiftKey: mods.shift ?? false,
  });

  it("⌘⇧Z, Ctrl+Shift+Z and Ctrl+Y redo; ⌘Z and Ctrl+Z undo; ⌘Y stays Chrome's", () => {
    expect(commandFor(key("z", { meta: true, shift: true }), "comment")).toEqual({ type: "redo" });
    expect(commandFor(key("Z", { ctrl: true, shift: true }), "comment")).toEqual({ type: "redo" });
    expect(commandFor(key("y", { ctrl: true }), "comment")).toEqual({ type: "redo" });
    expect(commandFor(key("z", { meta: true }), "comment")).toEqual({ type: "undo" });
    expect(commandFor(key("y", { meta: true }), "comment")).toBeNull();
  });
});
