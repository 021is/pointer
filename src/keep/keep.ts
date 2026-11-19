// The content script's side of keeping marks through a reload: it hands the marks, as data, to
// the service worker after each change (debounced), asks for them when Pointer opens on the page
// again, and forgets them on Clear and on closing Pointer. The worker keeps them in
// chrome.storage.session: in memory, for this tab and page only, gone when Chrome closes, never
// synced, never sent anywhere.

import type { Mark, Pasted, Pin } from "../marks/types";
import type { ElementEdits } from "../panel/edits";
import { selectorOf, shortName, viewRect } from "../pick/describe";
import type { KeepReply, KeepRequest } from "../shared/messages";
import {
  type Restored,
  type Saved,
  type Target,
  fitBudget,
  fromSaved,
  isSaved,
  pageKey,
  restoredMessage,
  toSaved,
} from "./saved";

/** chrome.storage.session holds 10 MB for the whole extension; one page keeps at most 4. */
export const PAGE_BUDGET = 4_000_000;

export type KeepHost = {
  marks: () => readonly Mark[];
  editsOf: (pin: Pin) => ElementEdits | null;
  say: (message: string, kind?: "ok" | "error") => void;
};

const label = (el: Element) => shortName(el, viewRect(el)).replace(/ \d+×\d+$/, "");

export function target(el: Element): Target {
  return { selector: selectorOf(el), tag: el.tagName, label: label(el) };
}

/** The element a target names, when it is still the same kind of element. */
export function find(t: Target): Element | null {
  try {
    const el = document.querySelector(t.selector);
    return el?.tagName === t.tag ? el : null;
  } catch {
    return null; // a selector this page's DOM can no longer parse finds nothing: the mark is "lost"
  }
}

async function ask(request: KeepRequest): Promise<KeepReply> {
  const reply = (await chrome.runtime.sendMessage(request)) as KeepReply | undefined;
  return reply ?? { ok: false, error: "the extension did not answer (reload it in chrome://extensions)" };
}

export function createKeeper(host: KeepHost) {
  const page = pageKey(location.href);
  const sources = new WeakMap<HTMLImageElement, string>();
  let ready = false;
  let last = "";
  let timer = 0;
  let warned = "";

  const warn = (message: string) => {
    if (warned === message) return;
    warned = message;
    host.say(message, "error");
  };

  /** A pasted image's data URL, read once in the background; null until it is. */
  function imageSrc(p: Pasted): string | null {
    const known = sources.get(p.img);
    if (known) return known;
    if (p.img.src.startsWith("data:")) return p.img.src;
    void fetch(p.img.src)
      .then((r) => r.blob())
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
          }),
      )
      .then((src) => {
        sources.set(p.img, src);
        schedule();
      })
      .catch((err: unknown) => warn(`A pasted image will not be kept through a reload: ${String(err)}`));
    return null;
  }

  async function save() {
    const { saved: whole } = toSaved(host.marks(), { target, editsOf: host.editsOf, imageSrc });
    const { saved, dropped } = fitBudget(whole, PAGE_BUDGET);
    const json = JSON.stringify(saved);
    if (json === last) return;
    last = json;
    if (dropped) warn(`Pasted images are too big to keep through a reload: ${dropped === 1 ? "one is" : `${dropped} are`} left out, the marks are kept.`);
    const reply = await ask(saved.marks.length ? { type: "keep:save", page, saved } : { type: "keep:clear", page });
    if (!reply.ok) warn(`Your marks will not survive a reload: ${reply.error}`);
  }

  function schedule() {
    if (!ready) return;
    clearTimeout(timer);
    timer = window.setTimeout(() => void save(), 400);
  }

  /** The marks this page had before its reload, found again on the page as it is now. */
  async function load(): Promise<Restored | null> {
    try {
      const reply = await ask({ type: "keep:load", page });
      if (!reply.ok) throw new Error(reply.error);
      const saved: Saved | null = isSaved(reply.saved) ? reply.saved : null;
      if (!saved) return null;
      last = JSON.stringify(saved);
      return fromSaved(saved, {
        find,
        at: (p) => document.elementFromPoint(p.x - scrollX, p.y - scrollY),
        image: (src) => Object.assign(new Image(), { src, draggable: false }),
      });
    } catch (err) {
      warn(`Your marks from before the reload could not be read: ${String(err)}`);
      return null;
    } finally {
      ready = true;
    }
  }

  function forget() {
    clearTimeout(timer);
    last = JSON.stringify({ v: 1, marks: [] });
    void ask({ type: "keep:clear", page }).then((reply) => {
      if (!reply.ok) warn(`Your marks could not be forgotten: ${reply.error}`);
    });
  }

  /** The marks back on the page, the picks' edits replayed, and what was lost named. Marks made
   *  while the answer was on its way win: nothing is mixed. */
  async function restore(set: (marks: Mark[]) => void, replay: (pin: Pin, edits: ElementEdits) => void) {
    const back = await load();
    if (!back || host.marks().length) return;
    set(back.marks);
    for (const r of back.replay) replay(r.pin, r.edits);
    const message = restoredMessage(back);
    if (message) host.say(message, back.lost.length ? "error" : "ok");
  }

  return { restore, schedule, forget };
}
