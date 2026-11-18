// The service worker's install hook, on a mocked chrome: the welcome page opens on a first
// install only, and a failure to open it is logged with its cause.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Listener = (details: { reason: string }) => void;

function mockChrome(create: (props: { url: string }) => Promise<unknown>) {
  const installed: Listener[] = [];
  const noop = { addListener: () => {} };
  vi.stubGlobal("chrome", {
    action: { onClicked: noop },
    runtime: {
      onInstalled: { addListener: (fn: Listener) => installed.push(fn) },
      onMessage: noop,
      getURL: (path: string) => `chrome-extension://pointer-id/${path}`,
    },
    tabs: { create },
  });
  return installed;
}

async function loadWorker() {
  vi.resetModules();
  await import("../src/background");
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("install opens the welcome page", () => {
  it("opens welcome.html on a first install", async () => {
    const create = vi.fn(async () => ({}));
    const installed = mockChrome(create);
    await loadWorker();
    for (const fn of installed) fn({ reason: "install" });
    expect(create).toHaveBeenCalledWith({ url: "chrome-extension://pointer-id/welcome.html" });
  });

  it("stays quiet on an update or a reload", async () => {
    const create = vi.fn(async () => ({}));
    const installed = mockChrome(create);
    await loadWorker();
    for (const fn of installed) fn({ reason: "update" });
    expect(create).not.toHaveBeenCalled();
  });

  it("logs why when the page cannot open", async () => {
    const installed = mockChrome(async () => {
      throw new Error("no window");
    });
    await loadWorker();
    for (const fn of installed) fn({ reason: "install" });
    await new Promise((r) => setTimeout(r, 0));
    expect(console.error).toHaveBeenCalledWith("Pointer: the welcome page did not open:", expect.any(Error));
  });
});
