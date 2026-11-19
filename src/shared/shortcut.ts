// The key Chrome gave Pointer's on/off command. Chrome may give none: it binds a suggested key
// only when nothing else holds it (another extension, one of Chrome's own), and it keeps an old
// binding until the extension is reloaded. So every place that names the key asks Chrome.

/** The command the icon runs; its key is the one people press. */
export const ACTION_COMMAND = "_execute_action";

/** Where a person sets or changes the key; an extension page may open it. */
export const SHORTCUTS_URL = "chrome://extensions/shortcuts";

/** The key bound now, as Chrome writes it ("⌥P" on a Mac), or null when none is set. */
export function shortcutOf(commands: readonly chrome.commands.Command[]): string | null {
  return commands.find((c) => c.name === ACTION_COMMAND)?.shortcut || null;
}

/** The icon's tooltip: the key, or where to set one. */
export const titleFor = (key: string | null) =>
  key ? `Pointer (${key})` : `Pointer (no shortcut: set one in ${SHORTCUTS_URL})`;
