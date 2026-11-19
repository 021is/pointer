// @vitest-environment happy-dom
// The welcome page names the key Chrome bound, or says none is set and offers
// chrome://extensions/shortcuts. The fixture holds welcome.html's ids (the real page is checked
// in Chromium with the built extension).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const body = `
  <span id="key-step">Press <kbd>Alt+P</kbd> (on a Mac <kbd>⌃⇧P</kbd>), or click Pointer's icon.</span>
  <section id="shortcut" hidden><button id="set-shortcut" type="button">Set a shortcut</button>
    <p id="set-shortcut-error"></p></section>`;

async function open(shortcut: string, create = vi.fn(async (_props: { url: string }) => ({}))) {
  document.body.innerHTML = body;
  vi.stubGlobal("chrome", {
    commands: { getAll: async () => [{ name: "_execute_action", shortcut }] },
    tabs: { create },
  });
  vi.resetModules();
  await import("../src/welcome");
  await new Promise((r) => setTimeout(r, 0));
  return create;
}

const text = (id: string) => document.getElementById(id)?.textContent?.replace(/\s+/g, " ").trim();
const notice = () => document.getElementById("shortcut") as HTMLElement;

beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the welcome page names the real shortcut", () => {
  it("shows the key Chrome bound, as Chrome writes it", async () => {
    await open("⌃⇧P");
    expect(text("key-step")).toBe("Press ⌃⇧P, or click Pointer's icon.");
    expect(notice().hidden).toBe(true);
  });

  it("says none is set and offers to set one", async () => {
    const create = await open("");
    expect(text("key-step")).toBe("Click Pointer's icon (no shortcut is set yet: see below).");
    expect(notice().hidden).toBe(false);
    (document.getElementById("set-shortcut") as HTMLButtonElement).click();
    expect(create).toHaveBeenCalledWith({ url: "chrome://extensions/shortcuts" });
  });

  it("says what to type when Chrome will not open the page", async () => {
    await open(
      "",
      vi.fn(async () => {
        throw new Error("refused");
      }),
    );
    (document.getElementById("set-shortcut") as HTMLButtonElement).click();
    await vi.waitFor(() => expect(text("set-shortcut-error")).toContain("type chrome://extensions/shortcuts"));
  });

  it("names no key when Chrome will not say which one, and says why", async () => {
    document.body.innerHTML = body;
    vi.stubGlobal("chrome", { commands: { getAll: async () => Promise.reject(new Error("no commands")) }, tabs: { create: vi.fn() } });
    vi.resetModules();
    await import("../src/welcome");
    await new Promise((r) => setTimeout(r, 0));
    expect(text("key-step")).toBe(
      "Click Pointer's icon (Chrome did not say which key Pointer has: no commands; see chrome://extensions/shortcuts).",
    );
  });
});
