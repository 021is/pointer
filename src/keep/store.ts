// The service worker's side of keeping marks through a reload: chrome.storage.session, one key per
// tab and page. Session storage lives in memory only: never written to disk, never synced, gone
// when Chrome closes, and Pointer drops a tab's keys when the tab closes.

import { type KeepReply, isKeepRequest } from "../shared/messages";
import { isSaved } from "./check";

const PREFIX = "keep:";
const keyOf = (tabId: number, page: string) => `${PREFIX}${tabId}:${page}`;

async function answer(tabId: number, message: unknown): Promise<KeepReply> {
  if (!isKeepRequest(message)) return { ok: false, error: "a keep message Pointer does not know" };
  const key = keyOf(tabId, message.page);
  switch (message.type) {
    case "keep:save":
      await chrome.storage.session.set({ [key]: message.saved });
      return { ok: true, saved: null };
    case "keep:load": {
      const value = (await chrome.storage.session.get(key))[key];
      if (value === undefined) return { ok: true, saved: null };
      // Never a silent null: kept data this version cannot read is said, and the page starts empty.
      return isSaved(value) ? { ok: true, saved: value } : { ok: false, error: "saved marks unreadable" };
    }
    case "keep:clear":
      await chrome.storage.session.remove(key);
      return { ok: true, saved: null };
  }
}

export function listenKeep(): void {
  chrome.runtime.onMessage.addListener((message: unknown, sender, reply: (r: KeepReply) => void) => {
    const type = typeof message === "object" && message !== null ? (message as { type?: unknown }).type : undefined;
    if (!(typeof type === "string" && type.startsWith(PREFIX))) return false;
    const tabId = sender.tab?.id;
    if (tabId === undefined) {
      reply({ ok: false, error: "asked from outside a tab" });
      return false;
    }
    answer(tabId, message).then(reply, (err: unknown) => reply({ ok: false, error: String(err) }));
    return true;
  });

  // A closed tab's marks go with it.
  chrome.tabs.onRemoved.addListener((tabId) => {
    chrome.storage.session
      .get(null)
      .then((all) => chrome.storage.session.remove(Object.keys(all).filter((k) => k.startsWith(`${PREFIX}${tabId}:`))))
      .catch((err: unknown) => console.error("Pointer: a closed tab's marks were not dropped:", err));
  });
}
