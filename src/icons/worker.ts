// The service worker's side of the icon picker: Lucide's data goes into the tab that asks, the
// first time its picker opens, as a file of the extension (activeTab already holds that tab).

import { type IconsLoaded, isIconsLoad } from "../shared/messages";

export function listenIcons(): void {
  chrome.runtime.onMessage.addListener((message: unknown, sender, reply: (r: IconsLoaded) => void) => {
    if (!isIconsLoad(message)) return false;
    const tabId = sender.tab?.id;
    if (tabId === undefined) {
      reply({ ok: false, error: "asked from outside a tab" });
      return false;
    }
    chrome.scripting.executeScript({ target: { tabId, frameIds: [sender.frameId ?? 0] }, files: ["lucide.js"] }).then(
      () => reply({ ok: true }),
      (err: unknown) => reply({ ok: false, error: String(err) }),
    );
    return true;
  });
}
