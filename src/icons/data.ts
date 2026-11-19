// Lucide's bundled data (dist/lucide.js), injected into this tab by the service worker the first
// time it is needed: the picker opening, or icons coming back after a reload. Never fetched.

import type { IconsLoad, IconsLoaded } from "../shared/messages";
import type { LucideData } from "./search";

declare global {
  // Set by dist/lucide.js in the content script's world.
  var __pointerLucide: LucideData | undefined;
}

export async function loadLucide(): Promise<LucideData> {
  if (globalThis.__pointerLucide) return globalThis.__pointerLucide;
  const ask: IconsLoad = { type: "icons:load" };
  const reply = (await chrome.runtime.sendMessage(ask)) as IconsLoaded | undefined;
  if (!reply?.ok) throw new Error(reply?.error ?? "the extension did not answer (reload it in chrome://extensions)");
  if (!globalThis.__pointerLucide) throw new Error("Lucide's icons did not load");
  return globalThis.__pointerLucide;
}
