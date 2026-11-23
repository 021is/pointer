// The one place that tells a Mac (⌘ keys, ⇧⌫) from the rest (Ctrl keys, Shift+Delete), and a
// finger from a mouse.

export const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/** A finger and no hover (a phone, DevTools' device mode with touch): words name taps, not keys.
 *  Asked each time: device mode can be switched on and off under an open Pointer. */
export const isTouch = () => typeof matchMedia === "function" && matchMedia("(hover: none) and (pointer: coarse)").matches;
