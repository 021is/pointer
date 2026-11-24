// The service worker's side of the icon picker (src/icons/worker.ts), on a mocked chrome: Lucide's
// file goes into the asking tab and frame only, the answer says whether it landed and why not,
// and a message that is not the picker's is left to the worker's other listeners.
import { afterEach, describe, expect, it, vi } from "vitest";
import { listenIcons } from "../src/icons/worker";

type Sender = { tab?: { id?: number }; frameId?: number };
type Listener = (message: unknown, sender: Sender, reply: (r: unknown) => void) => boolean;

function worker(inject: (details: unknown) => Promise<unknown>) {
  const added: Listener[] = [];
  const executeScript = vi.fn(inject);
  vi.stubGlobal("chrome", {
    runtime: { onMessage: { addListener: (fn: Listener) => added.push(fn) } },
    scripting: { executeScript },
  });
  listenIcons();
  const [first] = added;
  if (added.length !== 1 || !first) throw new Error(`listenIcons added ${added.length} listeners, not one`);
  const listener: Listener = first;
  const ask = (message: unknown, sender: Sender) => {
    const reply = vi.fn();
    const keepsChannel = listener(message, sender, reply);
    return { keepsChannel, reply };
  };
  return { ask, executeScript };
}

afterEach(() => vi.unstubAllGlobals());

describe("the icons' worker", () => {
  it("injects lucide.js into the asking tab's frame and answers ok, keeping the channel open", async () => {
    const w = worker(async () => [{ result: undefined }]);
    const { keepsChannel, reply } = w.ask({ type: "icons:load" }, { tab: { id: 7 }, frameId: 3 });
    expect(keepsChannel).toBe(true);
    expect(w.executeScript).toHaveBeenCalledWith({ target: { tabId: 7, frameIds: [3] }, files: ["lucide.js"] });
    await vi.waitFor(() => expect(reply).toHaveBeenCalledWith({ ok: true }));
  });

  it("a sender without a frame id is the tab's top frame", () => {
    const w = worker(async () => []);
    w.ask({ type: "icons:load" }, { tab: { id: 7 } });
    expect(w.executeScript).toHaveBeenCalledWith({ target: { tabId: 7, frameIds: [0] }, files: ["lucide.js"] });
  });

  it("a failed injection answers with its cause", async () => {
    const w = worker(async () => {
      throw new Error("Cannot access contents of the page");
    });
    const { reply } = w.ask({ type: "icons:load" }, { tab: { id: 7 }, frameId: 0 });
    await vi.waitFor(() =>
      expect(reply).toHaveBeenCalledWith({ ok: false, error: "Error: Cannot access contents of the page" }),
    );
  });

  it("asked from outside a tab: answers why at once and injects nothing", () => {
    const w = worker(async () => []);
    const { keepsChannel, reply } = w.ask({ type: "icons:load" }, {});
    expect(keepsChannel).toBe(false);
    expect(reply).toHaveBeenCalledWith({ ok: false, error: "asked from outside a tab" });
    expect(w.executeScript).not.toHaveBeenCalled();
  });

  it("another message is not its own: no answer, no injection, the channel left to others", () => {
    const w = worker(async () => []);
    for (const message of [{ type: "capture" }, "icons:load", null, { type: "icons:loaded" }]) {
      const { keepsChannel, reply } = w.ask(message, { tab: { id: 7 } });
      expect(keepsChannel).toBe(false);
      expect(reply).not.toHaveBeenCalled();
    }
    expect(w.executeScript).not.toHaveBeenCalled();
  });
});
