// The service worker's side of a framed screen: the page framed at Mobile (or any size) is a
// document of its own, so the probe (React fibers, Vue and Svelte metadata) must run in its world
// too. Injected into every frame of the tab the extension may reach: activeTab reaches the tab's
// own origin, which the framed page is; other sites' frames are skipped by Chrome. The probe
// starts only once per frame (its own guard), so the tab's own frame is left as it was.

import { type ScreenProbed, isScreenProbe } from "../shared/messages";

export function listenScreen(): void {
  chrome.runtime.onMessage.addListener((message: unknown, sender, reply: (r: ScreenProbed) => void) => {
    if (!isScreenProbe(message)) return false;
    const tabId = sender.tab?.id;
    if (tabId === undefined) {
      reply({ ok: false, error: "asked from outside a tab" });
      return false;
    }
    chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ["probe.js"], world: "MAIN" }).then(
      () => reply({ ok: true }),
      (err: unknown) => reply({ ok: false, error: String(err) }),
    );
    return true;
  });
}
