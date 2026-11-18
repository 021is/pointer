// The service worker: the icon or Alt+Shift+P turns Pointer on or off in the current tab (that
// click is what grants activeTab: no access to any site before it), and it takes the screenshot
// the picture is cropped from (only the extension may call captureVisibleTab).

import { type CaptureReply, isCaptureRequest } from "./shared/messages";

async function toggle(tab: chrome.tabs.Tab): Promise<void> {
  const tabId = tab.id;
  if (tabId === undefined) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["probe.js"], world: "MAIN" });
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    await chrome.action.setBadgeText({ tabId, text: "" });
    await chrome.action.setTitle({ tabId, title: "Pointer (Alt+Shift+P)" });
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
