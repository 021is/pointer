// The one place that tells a Mac (⌘ keys, ⇧⌫) from the rest (Ctrl keys, Shift+Delete).

export const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
