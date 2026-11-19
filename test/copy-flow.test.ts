// @vitest-environment happy-dom
// Copy's flow on its real outputs: what buildBundle gives per output, clear after copy with
// Undo, and the preview's payload and its failure. The screenshot and the probe are stubbed.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/capture/picture", () => ({
  screenshot: vi.fn(async () => ({ naturalWidth: 100, naturalHeight: 100 })),
  picture: vi.fn(async (_shot: unknown, _regions: unknown, _scene: unknown, strip: string | null) => ({
    blob: new Blob([strip ?? "no strip"], { type: "image/png" }),
    size: { w: 10, h: 10 },
  })),
}));
vi.mock("../src/source/client", () => ({
  componentOf: vi.fn(async () => ({ framework: "none", chain: [], where: { kind: "silent" } })),
}));

const { buildBundle } = await import("../src/capture/copy");
const { picture } = await import("../src/capture/picture");
const { copyFlow } = await import("../src/ui/copy-flow");
const { createHistory } = await import("../src/ui/history");
const { initialState } = await import("../src/ui/state");

function setup(output: "picture" | "text" | "image") {
  document.body.innerHTML = `<button id="b" style="width:80px;height:30px">Join</button>`;
  const el = document.getElementById("b") as Element;
  const state = { ...initialState(), output };
  state.marks = [{ kind: "comment", color: "red", el, at: { x: 10, y: 10 }, note: "bigger" }];
  return { state, host: document.createElement("div"), changesOf: () => [] };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("buildBundle per output", () => {
  it("Text only: the compact text, no picture", async () => {
    const { text, image } = buildBundle(setup("text"));
    expect(image).toBeNull();
    const body = (await text) ?? "";
    expect(body).toMatch(/^Pointer · /);
    expect(body).toContain("[1] comment · button");
    expect(body).toContain("note: bigger");
  });

  it("Picture only: the picture with no strip, and no text at all", async () => {
    const { text, image } = buildBundle(setup("image"));
    expect(text).toBeNull();
    await image;
    expect(vi.mocked(picture).mock.calls[0]?.[3]).toBeNull();
  });

  it("Picture + text: a strip under the picture and the full text beside it", async () => {
    const { text, image } = buildBundle(setup("picture"));
    await image;
    expect(vi.mocked(picture).mock.calls[0]?.[3]).toContain("[1] comment");
    expect(await text).toContain("image: 10×10");
  });
});

describe("copyFlow", () => {
  let said: { message: string; action?: { label: string; run: () => void } }[];
  let flashed: string[];

  beforeEach(() => {
    said = [];
    flashed = [];
  });

  function flow(ctx: ReturnType<typeof setup>) {
    const hooks = () => ({
      changesOf: () => [],
      onPick: () => {},
      onRemove: () => {},
      park: () => () => {},
      togglePanel: () => "no-pick" as const,
      panelFor: () => null,
    });
    const say = (message: string, _kind?: "ok" | "error", action?: { label: string; run: () => void }) =>
      said.push({ message, action });
    const update = (change: () => void) => change();
    const { clear } = createHistory({ state: ctx.state, hooks, say, update });
    return copyFlow({
      state: ctx.state,
      host: ctx.host,
      hooks,
      say,
      flash: (m) => flashed.push(m),
      update,
      setOutput: (o) => (ctx.state.output = o),
      clear,
    });
  }

  it("clear after copy empties the page, and Undo brings the marks back", async () => {
    const ctx = setup("text");
    ctx.state.clearAfterCopy = true;
    const write = vi.fn(async () => {});
    vi.stubGlobal("navigator", { clipboard: { write } });
    vi.stubGlobal("ClipboardItem", class { constructor(public parts: unknown) {} });
    const before = ctx.state.marks.slice();
    flow(ctx).copy();
    await vi.waitFor(() => expect(flashed.length).toBe(1));
    expect(flashed[0]).toMatch(/^Copied · 1 mark · ≈\d+ tok$/);
    expect(ctx.state.marks).toEqual([]);
    const undo = said.find((s) => s.action?.label === "Undo");
    undo?.action?.run();
    expect(ctx.state.marks).toEqual(before);
  });

  it("the preview sends the very result, and a refused tab says why", async () => {
    const ctx = setup("picture");
    const sent: unknown[] = [];
    const sendMessage = async (m: unknown) => {
      sent.push(m);
      return { ok: false, error: "no window" };
    };
    vi.stubGlobal("chrome", { runtime: { sendMessage } });
    await flow(ctx).preview();
    expect(sent[0]).toMatchObject({ type: "preview", text: expect.stringContaining("[1] comment"), tokens: 1, output: "picture" });
    expect((sent[0] as { png: string }).png).toMatch(/^data:image\/png;base64,/);
    expect(said.at(-1)?.message).toBe("Preview failed: no window");
  });
});
