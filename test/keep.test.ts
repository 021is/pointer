// @vitest-environment happy-dom
// Marks kept through a reload: save → restore on a fresh DOM, a pick that is gone says "lost",
// big pasted images go first, Clear and closing forget, and the worker keeps one key per tab+page.
import { afterEach, describe, expect, it, vi } from "vitest";
import { find, target } from "../src/keep/keep";
import { fitBudget, fromSaved, pageKey, restoredMessage, toSaved } from "../src/keep/saved";
import type { Mark, Pasted, Pin } from "../src/marks/types";
import { isKeepRequest } from "../src/shared/messages";

const page = () => {
  document.body.innerHTML = `<main><button data-testid="join">Join</button><p class="lead">Hi</p></main>`;
  return {
    join: document.querySelector("[data-testid=join]") as Element,
    lead: document.querySelector(".lead") as Element,
  };
};
const edits = { props: [{ prop: "font-size", before: "14px", change: { kind: "set" as const, value: "18px" } }], removedClasses: [], addedClasses: [] };

function marksOn(els: ReturnType<typeof page>): Mark[] {
  const pick: Pin = { kind: "pick", color: "red", el: els.join, at: { x: 5, y: 5 }, note: "bigger" };
  const comment: Pin = { kind: "comment", color: "blue", el: els.lead, at: { x: 40, y: 60 }, note: "less air" };
  const img = Object.assign(new Image(), { src: "data:image/png;base64,AAAA" });
  const pasted: Pasted = { kind: "image", img, rect: { x: 1, y: 2, w: 30, h: 20 }, opacity: 0.5 };
  return [pick, comment, { kind: "box", color: "red", rect: { x: 0, y: 0, w: 9, h: 9 } }, { kind: "crop", el: null, rect: { x: 1, y: 1, w: 50, h: 50 } }, pasted];
}

const world = {
  target,
  editsOf: (p: Pin) => (p.kind === "pick" ? edits : null),
  imageSrc: (p: Pasted) => p.img.src,
};
const restoreWorld = { find, at: () => null, image: (src: string) => Object.assign(new Image(), { src }), page: document.body };

afterEach(() => vi.unstubAllGlobals());

describe("save and restore", () => {
  it("every mark comes back on the reloaded page, the pick's CSS edits with it", () => {
    const { saved } = toSaved(marksOn(page()), world);
    const json = JSON.parse(JSON.stringify(saved));
    const fresh = page(); // the reload: new elements, same page
    const back = fromSaved(json, restoreWorld);
    expect(back.lost).toEqual([]);
    expect(back.marks.map((m) => m.kind)).toEqual(["pick", "comment", "box", "crop", "image"]);
    expect((back.marks[0] as Pin).el).toBe(fresh.join);
    expect((back.marks[1] as Pin).note).toBe("less air");
    expect(back.replay).toEqual([{ pin: back.marks[0], edits }]);
    expect((back.marks[4] as Pasted).opacity).toBe(0.5);
    expect(restoredMessage(back)).toBe("5 marks are back from before the reload.");
  });

  it("a pick whose element is gone is named as lost, never dropped silently", () => {
    const { saved } = toSaved(marksOn(page()), world);
    document.body.innerHTML = `<main><p class="lead">Hi</p></main>`;
    const back = fromSaved(saved, restoreWorld);
    expect(back.lost).toEqual(["pick button"]);
    expect(back.marks.map((m) => m.kind)).toEqual(["comment", "box", "crop", "image"]);
    expect(restoredMessage(back)).toBe("4 marks are back from before the reload. Not on the page any more: pick button.");
  });

  it("an element of another kind under the same selector is not taken for it", () => {
    page();
    const t = target(document.querySelector(".lead") as Element);
    document.body.innerHTML = `<main><button data-testid="join">Join</button><div class="lead">Hi</div></main>`;
    expect(find(t)).toBeNull();
  });

  it("an image still being read waits for the next save", () => {
    const { saved, pending } = toSaved(marksOn(page()), { ...world, imageSrc: () => null });
    expect(pending).toBe(1);
    expect(saved.marks.some((m) => m.kind === "image")).toBe(false);
  });

  it("over the budget, pasted images go first and the marks stay", () => {
    const { saved } = toSaved(marksOn(page()), world);
    const { saved: fit, dropped } = fitBudget(saved, 200);
    expect(dropped).toBe(1);
    expect(fit.marks.map((m) => m.kind)).toEqual(["pin", "pin", "shape", "crop"]);
    expect(fitBudget(saved, 1e6).dropped).toBe(0);
  });

  it("one page whatever its query or hash", () => {
    expect(pageKey("http://localhost:3300/events?x=1#top")).toBe("http://localhost:3300/events");
  });
});

describe("the worker's store", () => {
  async function worker() {
    const store = new Map<string, unknown>();
    let onMessage: (m: unknown, s: { tab?: { id: number } }, r: (x: unknown) => void) => boolean = () => false;
    let onRemoved: (tabId: number) => void = () => {};
    vi.stubGlobal("chrome", {
      runtime: { onMessage: { addListener: (fn: typeof onMessage) => (onMessage = fn) } },
      tabs: { onRemoved: { addListener: (fn: typeof onRemoved) => (onRemoved = fn) } },
      storage: {
        session: {
          set: async (o: Record<string, unknown>) => {
            for (const [k, v] of Object.entries(o)) store.set(k, v);
          },
          get: async (k: string | null) => (k === null ? Object.fromEntries(store) : { [k]: store.get(k) }),
          remove: async (k: string | string[]) => {
            for (const x of [k].flat()) store.delete(x);
          },
        },
      },
    });
    vi.resetModules();
    const { listenKeep } = await import("../src/keep/store");
    listenKeep();
    const send = (m: unknown, tab = 7) => new Promise((r) => onMessage(m, { tab: { id: tab } }, r));
    return { store, send, closeTab: (id: number) => onRemoved(id) };
  }
  const saved = { v: 1, marks: [{ kind: "shape", shape: { kind: "box", color: "red", rect: { x: 0, y: 0, w: 1, h: 1 } } }] };
  const at = "http://localhost:5173/";

  it("keeps per tab and page, forgets on clear and when the tab closes", async () => {
    const w = await worker();
    expect(await w.send({ type: "keep:save", page: at, saved })).toEqual({ ok: true, saved: null });
    expect(await w.send({ type: "keep:load", page: at })).toEqual({ ok: true, saved });
    expect(await w.send({ type: "keep:load", page: at }, 8)).toEqual({ ok: true, saved: null });
    await w.send({ type: "keep:clear", page: at });
    expect(w.store.size).toBe(0);
    await w.send({ type: "keep:save", page: at, saved });
    w.closeTab(7);
    await vi.waitFor(() => expect(w.store.size).toBe(0));
  });

  it("refuses what is not a keep message from a page", () => {
    expect(isKeepRequest({ type: "keep:save", page: at, saved: { v: 2, marks: [] } })).toBe(false);
    expect(isKeepRequest({ type: "keep:load", page: "chrome://extensions" })).toBe(false);
    expect(isKeepRequest({ type: "keep:clear", page: at })).toBe(true);
  });
});
