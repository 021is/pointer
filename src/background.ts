// The service worker: the icon or Alt+P turns Pointer on or off in the current tab (that
// click is what grants activeTab: no access to any site before it), and it takes the screenshot
// the picture is cropped from (only the extension may call captureVisibleTab). It also opens the
// preview of what Copy would give in a tab of Pointer's own, and hands that page the result.

import {
  type CaptureReply,
  type Preview,
  type PreviewReply,
  isCaptureRequest,
  isPreviewAsk,
  isPreviewRequest,
} from "./shared/messages";

/** The last preview, held only until its page has taken it (in memory, never stored). */
let preview: Preview | null = null;

chrome.runtime.onMessage.addListener((message: unknown, _sender, reply: (r: PreviewReply | Preview | null) => void) => {
  if (isPreviewRequest(message)) {
    const { type: _type, ...rest } = message;
    preview = rest;
    // The answer goes back to the page that asked: opened, or why not (shown to the person there).
    chrome.tabs.create({ url: chrome.runtime.getURL("preview.html") }).then(
      () => reply({ ok: true }),
      (err: unknown) => reply({ ok: false, error: `the preview tab did not open: ${String(err)}` }),
    );
    return true;
  }
  if (isPreviewAsk(message)) {
    reply(preview);
    preview = null;
    return false;
  }
  return false;
});

/** The icon's tooltip names the shortcut as Chrome has it now: ⌥P on a Mac, a key the person
 *  changed in chrome://extensions/shortcuts, or none set (Edvard, 2026-11-18, on a Mac). Chrome
 *  may refuse a suggested key: Chromium 157 on Linux left Alt+Shift+P unset, so the default is
 *  Alt+P (Edvard, 2026-11-18), and the tooltip never names a key Chrome did not bind. */
async function title(): Promise<string> {
  const commands = await chrome.commands.getAll();
  const key = commands.find((c) => c.name === "_execute_action")?.shortcut;
  return key ? `Pointer (${key})` : "Pointer (no shortcut: set one in chrome://extensions/shortcuts)";
}

const setTitle = (tabId?: number) =>
  title()
    .then((t) => chrome.action.setTitle(tabId === undefined ? { title: t } : { tabId, title: t }))
    .catch((err: unknown) => console.error("Pointer: the icon's title was not set:", err));

void setTitle();

async function toggle(tab: chrome.tabs.Tab): Promise<void> {
  const tabId = tab.id;
  if (tabId === undefined) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["probe.js"], world: "MAIN" });
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    await chrome.action.setBadgeText({ tabId, text: "" });
    await setTitle(tabId);
  } catch (err) {
    // chrome:// pages, the Web Store and the PDF viewer refuse every extension's scripts.
    await chrome.action.setBadgeBackgroundColor({ tabId, color: "#ff3366" });
    await chrome.action.setBadgeText({ tabId, text: "!" });
    await chrome.action.setTitle({ tabId, title: `Pointer can't run on this page: ${String(err)}` });
  }
}

chrome.action.onClicked.addListener((tab) => {
  void toggle(tab);
});

// The first install opens the welcome page (the extension's own page: no permission needed).
// Updates and reloads do not; a page that fails to open says why in the service worker's log.
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason !== "install") return;
  chrome.tabs
    .create({ url: chrome.runtime.getURL("welcome.html") })
    .catch((err: unknown) => console.error("Pointer: the welcome page did not open:", err));
});

chrome.runtime.onMessage.addListener((message: unknown, sender, reply: (r: CaptureReply) => void) => {
  if (!isCaptureRequest(message)) return false;
  const windowId = sender.tab?.windowId;
  if (windowId === undefined) {
    reply({ ok: false, error: "capture asked from outside a tab" });
    return false;
  }
  chrome.tabs.captureVisibleTab(windowId, { format: "png" }).then(
    (dataUrl) => reply({ ok: true, dataUrl }),
    (err: unknown) => reply({ ok: false, error: String(err) }),
  );
  return true;
});
