// The extension's side of the probe: asks the page's world about one element and waits for the
// answer, at most a few seconds. Answers are cached per element.

import type { ComponentInfo } from "../bundle/types";
import { ANSWER, ASK, PROBE_ATTR } from "./protocol";

const TIMEOUT_MS = 4000;

const cache = new WeakMap<Element, Promise<ComponentInfo>>();
let next = 0;

function ask(el: Element): Promise<ComponentInfo> {
  const id = `p${++next}`;
  el.setAttribute(PROBE_ATTR, id);
  return new Promise<ComponentInfo>((resolve) => {
    const done = (info: ComponentInfo) => {
      window.removeEventListener(ANSWER, onAnswer);
      clearTimeout(timer);
      if (el.getAttribute(PROBE_ATTR) === id) el.removeAttribute(PROBE_ATTR);
      resolve(info);
    };
    const onAnswer = (event: Event) => {
      if (!(event instanceof CustomEvent) || typeof event.detail !== "string") return;
      const reply = JSON.parse(event.detail) as { id: string; info: ComponentInfo };
      if (reply.id === id) done(reply.info);
    };
    const timer = setTimeout(
      () => done({ framework: "none", chain: [], sourceNote: "the page did not answer in time" }),
      TIMEOUT_MS,
    );
    window.addEventListener(ANSWER, onAnswer);
    window.dispatchEvent(new CustomEvent(ASK, { detail: JSON.stringify({ id }) }));
  });
}

export function componentOf(el: Element): Promise<ComponentInfo> {
  let found = cache.get(el);
  if (!found) {
    found = ask(el);
    cache.set(el, found);
  }
  return found;
}
