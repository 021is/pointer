// @vitest-environment happy-dom
// The keeper's restore path and its checks (TF153 review): marks made before the answer win, a
// pasted image is read and saved once its data URL is ready, unreadable kept data is said, and a
// damaged shape or a pick's damaged edits never reach the page.
import { afterEach, describe, expect, it, vi } from "vitest";
import { isSavedMark } from "../src/keep/check";
import { createKeeper } from "../src/keep/keep";
import type { Mark, Pasted } from "../src/marks/types";

type Sent = { type: string; saved?: { marks: { kind: string; src?: string }[] } };

function chromeWith(load: unknown) {
  const sent: Sent[] = [];
  vi.stubGlobal("chrome", {
    runtime: {
      sendMessage: async (m: Sent) => {
        sent.push(m);
        return m.type === "keep:load" ? load : { ok: true, saved: null };
      },
    },
  });
  return sent;
}

const box = { kind: "shape", shape: { kind: "box", color: "red", rect: { x: 1, y: 2, w: 30, h: 20 } } };
const said: string[] = [];
const keeper = (marks: Mark[]) => createKeeper({ marks: () => marks, editsOf: () => null, say: (m) => said.push(m) });

afterEach(() => {
  vi.unstubAllGlobals();
  said.length = 0;
});

describe("restore", () => {
  it("puts the kept marks back and says so", async () => {
    chromeWith({ ok: true, saved: { v: 1, marks: [box] } });
    const set = vi.fn();
    await keeper([]).restore(set, () => {});
    expect(set).toHaveBeenCalledWith([box.shape]);
    expect(said).toEqual(["1 mark is back from before the reload."]);
  });

  it("marks made while the answer was on its way win: nothing is mixed", async () => {
    chromeWith({ ok: true, saved: { v: 1, marks: [box] } });
    const set = vi.fn();
    const mine: Mark = { kind: "arrow", color: "blue", from: { x: 0, y: 0 }, to: { x: 9, y: 9 } };
    await keeper([mine]).restore(set, () => {});
    expect(set).not.toHaveBeenCalled();
  });

  it("kept data this version cannot read is said, never a silent empty page", async () => {
    chromeWith({ ok: false, error: "saved marks unreadable" });
    const set = vi.fn();
    await keeper([]).restore(set, () => {});
    expect(set).not.toHaveBeenCalled();
    expect(said).toEqual(["Your marks from before the reload could not be read: saved marks unreadable."]);
  });

  it("a pasted image is read to a data URL, then saved with the marks", async () => {
    const sent = chromeWith({ ok: true, saved: null });
    vi.stubGlobal("fetch", async () => new Response(new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" })));
    const img = Object.assign(new Image(), { src: "blob:http://localhost/1" });
    const pasted: Pasted = { kind: "image", img, rect: { x: 0, y: 0, w: 10, h: 10 }, opacity: 1 };
    const k = keeper([pasted]);
    await k.restore(() => {}, () => {});
    k.schedule();
    await vi.waitFor(() => expect(sent.some((m) => m.saved?.marks.some((x) => x.kind === "image"))).toBe(true), { timeout: 3000 });
    const image = sent.findLast((m) => m.type === "keep:save")?.saved?.marks[0];
    expect(image?.src).toMatch(/^data:image\/png;base64,/);
  });
});

describe("the worker's answer for unreadable kept data", () => {
  it("is an error, not a silent null", async () => {
    let onMessage: ((m: unknown, s: object, r: (x: unknown) => void) => boolean) | undefined;
    vi.stubGlobal("chrome", {
      runtime: { onMessage: { addListener: (fn: typeof onMessage) => (onMessage = fn) } },
      tabs: { onRemoved: { addListener: () => {} } },
      storage: { session: { get: async (k: string) => ({ [k]: { v: 1, marks: [7] } }) } },
    });
    vi.resetModules();
    (await import("../src/keep/store")).listenKeep();
    const reply = await new Promise((r) => onMessage?.({ type: "keep:load", page: "http://x/" }, { tab: { id: 1 } }, r));
    expect(reply).toEqual({ ok: false, error: "saved marks unreadable" });
  });
});

describe("each kept mark is checked field by field", () => {
  it("a shape needs its own fields: a box without its rect is refused", () => {
    expect(isSavedMark(box)).toBe(true);
    expect(isSavedMark({ kind: "shape", shape: { kind: "box", color: "red" } })).toBe(false);
    expect(isSavedMark({ kind: "shape", shape: { kind: "pen", color: "red", points: [{ x: 1 }] } })).toBe(false);
    expect(isSavedMark({ kind: "shape", shape: { kind: "text", color: "red", at: { x: 1, y: 1 }, text: "hi" } })).toBe(true);
  });

  it("a pick's style edits are checked before the style box replays them", () => {
    const pin = { kind: "pin", pin: "pick", color: "red", at: { x: 0, y: 0 }, note: "", target: { selector: "b", tag: "B", label: "b" } };
    const good = { props: [{ prop: "gap", before: "8px", change: { kind: "set", value: "12px" } }], removedClasses: [], addedClasses: [] };
    expect(isSavedMark({ ...pin, edits: good })).toBe(true);
    expect(isSavedMark({ ...pin, edits: null })).toBe(true);
    expect(isSavedMark({ ...pin, edits: { props: [{ prop: "gap" }], removedClasses: [], addedClasses: [] } })).toBe(false);
    expect(isSavedMark({ ...pin, edits: { ...good, change: undefined, props: [{ prop: "gap", before: "8px", change: { kind: "set" } }] } })).toBe(false);
  });
});
