// Injected into the page's own (MAIN) world: only there are React's fibers and Vue's instances
// visible. The extension's side marks an element with data-pointer-probe and asks by event.

import { type ComponentInfo, unknown } from "../bundle/types";
import { describeComponent } from "./frameworks";
import { ANSWER, ASK, type Answer, type Ask, PROBE_ATTR, readMessage } from "./protocol";

declare global {
  interface Window {
    __pointerProbe?: true;
  }
}

async function answer(id: string): Promise<ComponentInfo> {
  const el = document.querySelector(`[${PROBE_ATTR}="${CSS.escape(id)}"]`);
  if (!el) return unknown("the element left the page");
  try {
    return await describeComponent(el);
  } catch (err) {
    return unknown(`lookup failed: ${String(err)}`);
  }
}

function onAsk(event: Event): void {
  const ask = readMessage<Ask>(event);
  if (ask === null) return;
  if (ask instanceof Error) {
    console.warn("Pointer: unreadable probe request:", ask.message);
    return;
  }
  void answer(ask.id).then((info) => {
    const reply: Answer = { id: ask.id, info };
    window.dispatchEvent(new CustomEvent(ANSWER, { detail: JSON.stringify(reply) }));
  });
}

if (!window.__pointerProbe) {
  window.__pointerProbe = true;
  window.addEventListener(ASK, onAsk);
}
