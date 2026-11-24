// @vitest-environment happy-dom
// Esc is Pointer's while it is open (Edvard, 2026-11-24: "sometimes when I escape it closes my
// sheet in my app instead of closing the pointer"): Pointer's look at it on the window, in the
// capture phase (ui/app.ts), comes before the page's listeners on document and its elements and
// after it, and keeps both the keydown and its keyup from them. Only with the Page tool and nothing
// of Pointer's open does the page get its Esc, untouched. A page listener on the window's capture
// phase added before Pointer opened still runs first: no script can come before it.
import { afterEach, describe, expect, it } from "vitest";
import { openBubble } from "../src/ui/bubble";
import { keyHandler } from "../src/ui/keyboard";
import type { Tool } from "../src/ui/state";
import { actions } from "./key-actions";

const added: [EventTarget, string, EventListener, boolean][] = [];
const on = (target: EventTarget, type: string, fn: EventListener, capture: boolean) => {
  target.addEventListener(type, fn, capture);
  added.push([target, type, fn, capture]);
};

afterEach(() => {
  for (const [target, type, fn, capture] of added.splice(0)) target.removeEventListener(type, fn, capture);
  document.body.innerHTML = "";
});

/** Pointer open with a tool, its keys on the window's capture phase as app.ts puts them. */
function pointer(tool: Tool, somethingOpen = false) {
  const run = actions(false, somethingOpen);
  const keys = keyHandler(() => tool, run);
  on(window, "keydown", keys.keydown as EventListener, true);
  on(window, "keyup", keys.keyup as EventListener, true);
  return run;
}

/** The page's own Esc listeners, added after Pointer opened: window (both phases after Pointer's),
 *  document and an element, capture and bubble, keydown and keyup. */
function page(): string[] {
  const heard: string[] = [];
  const where: [EventTarget, string][] = [
    [window, "window"],
    [document, "document"],
    [document.body, "body"],
  ];
  for (const [target, name] of where) {
    for (const capture of [true, false]) {
      for (const type of ["keydown", "keyup"]) {
        const hear = (e: Event) => {
          if (e instanceof KeyboardEvent && e.key === "Escape") heard.push(`${name} ${type} ${capture ? "capture" : "bubble"}`);
        };
        on(target, type, hear, capture);
      }
    }
  }
  return heard;
}

/** Esc down and up at `target`, as the browser sends it (composed: it leaves shadow roots). */
function esc(target: EventTarget = document.body): KeyboardEvent {
  const down = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true, composed: true });
  target.dispatchEvent(down);
  target.dispatchEvent(new KeyboardEvent("keyup", { key: "Escape", bubbles: true, cancelable: true, composed: true }));
  return down;
}

describe("Esc while Pointer is open", () => {
  it("with a mark tool, is Pointer's: it leaves the tool for Page, and the page never hears its keydown or keyup", () => {
    const run = pointer("comment");
    const heard = page();
    expect(esc().defaultPrevented).toBe(true);
    expect(run.tool).toHaveBeenCalledWith("page");
    expect(heard).toEqual([]);
  });

  it("with a menu or the sheet open, closes that first, even with the Page tool, and the page hears nothing", () => {
    const run = pointer("page", true);
    const heard = page();
    esc();
    expect(run.escape).toHaveBeenCalledOnce();
    expect(run.tool).not.toHaveBeenCalled();
    expect(heard).toEqual([]);
  });

  it("with the Page tool and nothing of Pointer's open, goes to the page untouched, keyup too", () => {
    const run = pointer("page");
    const heard = page();
    expect(esc().defaultPrevented).toBe(false);
    expect(run.tool).not.toHaveBeenCalled();
    expect(heard).toHaveLength(12);
  });

  it("in the comment box, closes the note, never the page's own sheet", async () => {
    pointer("comment");
    const host = document.createElement("div");
    document.body.append(host);
    const root = host.attachShadow({ mode: "open" });
    const note = openBubble(root, { at: { x: 10, y: 10 }, placeholder: "Comment", hint: "" });
    const heard = page();
    const input = root.querySelector("textarea") as HTMLTextAreaElement;
    input.value = "half a thought";
    esc(input);
    await expect(note).resolves.toBeNull();
    expect(root.querySelector(".bubble")).toBeNull();
    expect(heard).toEqual([]);
  });
});
