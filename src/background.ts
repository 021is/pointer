// The service worker: the icon or its shortcut turns Pointer on or off in the current tab (that
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
import { shortcutOf, titleFor } from "./shared/shortcut";
import { listenIcons } from "./icons/worker";
import { listenKeep } from "./keep/store";
import { listenScreen } from "./screen/worker";

listenKeep();
listenIcons();
listenScreen();

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

/** The shortcut as Chrome has it now: the default (Alt+P; ⌃⇧P on a Mac), a key the person set in
 *  chrome://extensions/shortcuts, or none. The defaults are keys Chrome binds on a fresh profile
 *  and that type no character: Chromium 157 on Linux left Alt+Shift+P unset, and on a Mac an
 *  Option key types one (⌥P is π), so the Mac's is Control+Shift+P (Edvard, 2026-11-19). */
const currentKey = async () => shortcutOf(await chrome.commands.getAll());

/** The icon's tooltip never names a key Chrome did not bind. */
const setTitle = (tabId?: number) =>
  currentKey()
    .then(titleFor)
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

const openWelcome = (hash = "") =>
  chrome.tabs
    .create({ url: chrome.runtime.getURL(`welcome.html${hash}`) })
    .catch((err: unknown) => console.error("Pointer: the welcome page did not open:", err));

// The first install opens the welcome page (the extension's own page: no permission needed). An
// update or a reload opens it only when it left Pointer with no shortcut, at the part that says
// how to set one: a key that silently stops working is worse than a tab (Edvard, 2026-11-19, on
// a Mac: "the shortcut is gone"). A page that fails to open says why in the service worker's log.
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") return void openWelcome();
  if (reason !== "update") return;
  currentKey()
    .then((key) => (key ? undefined : openWelcome("#shortcut")))
    .catch((err: unknown) => console.error("Pointer: the shortcut was not read:", err));
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
