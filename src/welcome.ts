// The welcome page names the key Chrome gave Pointer, never a key it may not have: Chrome binds
// the suggested key only when nothing else holds it. With no key, the page says so at the top
// of the steps and offers a button to chrome://extensions/shortcuts.

import { SHORTCUTS_URL, shortcutOf } from "./shared/shortcut";

const $ = (id: string) => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`welcome.html has no #${id}`);
  return el;
};

const kbd = (text: string) => Object.assign(document.createElement("kbd"), { textContent: text });

/** Step 2 with the real key, or with the icon only and the way to set a key. */
export function showShortcut(key: string | null) {
  const step = $("key-step");
  if (key) step.replaceChildren("Press ", kbd(key), ", or click Pointer's icon.");
  else step.replaceChildren("Click Pointer's icon (no shortcut is set yet: see below).");
  $("shortcut").hidden = key !== null;
}

async function start() {
  $("set-shortcut").addEventListener("click", () => {
    chrome.tabs.create({ url: SHORTCUTS_URL }).catch((err: unknown) => {
      $("set-shortcut-error").textContent = `Chrome did not open it (${String(err)}): type ${SHORTCUTS_URL} in the address bar.`;
    });
  });
  try {
    showShortcut(shortcutOf(await chrome.commands.getAll()));
  } catch (err) {
    // Never a key Chrome may not have bound: the step names the icon and says why, and where to look.
    const why = err instanceof Error ? err.message : String(err);
    $("key-step").replaceChildren(`Click Pointer's icon (Chrome did not say which key Pointer has: ${why}; see ${SHORTCUTS_URL}).`);
  }
}

void start();
