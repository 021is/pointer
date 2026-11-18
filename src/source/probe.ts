// Injected into the page's own (MAIN) world: only there are React's fibers and Vue's instances
// visible. The extension's side marks an element with data-pointer-probe and asks by event;
// the answer goes back as a JSON string (objects do not cross between worlds).

import type { ComponentInfo } from "../bundle/types";
import { describeComponent } from "./frameworks";
import { ANSWER, ASK, PROBE_ATTR } from "./protocol";

declare global {
  interface Window {
    __pointerProbe?: true;
  }
}

async function answer(id: string): Promise<ComponentInfo> {
  const el = document.querySelector(`[${PROBE_ATTR}="${CSS.escape(id)}"]`);
  if (!el) return { framework: "none", chain: [], sourceNote: "the element left the page" };
  try {
    return await describeComponent(el);
  } catch (err) {
    return { framework: "none", chain: [], sourceNote: `lookup failed: ${String(err)}` };
  }
}

function onAsk(event: Event): void {
  if (!(event instanceof CustomEvent) || typeof event.detail !== "string") return;
  const { id } = JSON.parse(event.detail) as { id: string };
  void answer(id).then((info) => {
    window.dispatchEvent(new CustomEvent(ANSWER, { detail: JSON.stringify({ id, info }) }));
  });
}

if (!window.__pointerProbe) {
  window.__pointerProbe = true;
  window.addEventListener(ASK, onAsk);
}
