// The messages between the content script, the service worker and the preview page: take the
// screenshot; show a preview of what Copy would give; hand that preview to the page that asks;
// keep a page's marks through its reload; load the icons; probe a page framed at a screen size.

import { isSaved } from "../keep/check";
import type { Saved } from "../keep/saved";
import type { Output } from "../ui/state";

export type CaptureRequest = { type: "capture" };
export type CaptureReply = { ok: true; dataUrl: string } | { ok: false; error: string };

/** What Copy would give: the picture (a data URL) and/or the text, its cost, and which output. */
export type Preview = { png: string | null; text: string | null; tokens: number; output: Output };
export type PreviewRequest = { type: "preview" } & Preview;
export type PreviewReply = { ok: true } | { ok: false; error: string };
export type PreviewAsk = { type: "preview:get" };

const OUTPUTS: readonly Output[] = ["picture", "text", "image"];
const typeOf = (message: unknown) => (message as { type?: unknown } | null)?.type;

export function isCaptureRequest(message: unknown): message is CaptureRequest {
  return typeOf(message) === "capture";
}

/** A preview from the content script, checked where it enters the service worker. */
export function isPreviewRequest(message: unknown): message is PreviewRequest {
  const m = message as Partial<PreviewRequest> | null;
  return (
    typeOf(message) === "preview" &&
    (m?.png === null || (typeof m?.png === "string" && m.png.startsWith("data:image/png;base64,"))) &&
    (m?.text === null || typeof m?.text === "string") &&
    typeof m?.tokens === "number" &&
    OUTPUTS.includes(m?.output as Output)
  );
}

export function isPreviewAsk(message: unknown): message is PreviewAsk {
  return typeOf(message) === "preview:get";
}

/** Marks kept through a reload, per tab and page (keep/): save them, ask for them, forget them. */
export type KeepRequest =
  | { type: "keep:save"; page: string; saved: Saved }
  | { type: "keep:load"; page: string }
  | { type: "keep:clear"; page: string };
export type KeepReply = { ok: true; saved: Saved | null } | { ok: false; error: string };

/** A keep request from the content script, checked where it enters the service worker. */
export function isKeepRequest(message: unknown): message is KeepRequest {
  const m = message as Partial<{ type: string; page: unknown; saved: unknown }> | null;
  if (typeof m?.page !== "string" || !/^(https?|file):\/\//.test(m.page)) return false;
  if (m.type === "keep:save") return isSaved(m.saved);
  return m.type === "keep:load" || m.type === "keep:clear";
}

/** The icon picker opened: inject Lucide's data (dist/lucide.js) into the asking tab. */
export type IconsLoad = { type: "icons:load" };
export type IconsLoaded = { ok: true } | { ok: false; error: string };

export function isIconsLoad(message: unknown): message is IconsLoad {
  return typeOf(message) === "icons:load";
}

/** A framed screen loaded its page: put the probe into that frame's own world too (screen/). */
export type ScreenProbe = { type: "screen:probe" };
export type ScreenProbed = { ok: true } | { ok: false; error: string };

export function isScreenProbe(message: unknown): message is ScreenProbe {
  return typeOf(message) === "screen:probe";
}
