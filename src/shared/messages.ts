// The messages between the content script, the service worker and the preview page: take the
// screenshot; show a preview of what Copy would give; hand that preview to the page that asks.

export type CaptureRequest = { type: "capture" };
export type CaptureReply = { ok: true; dataUrl: string } | { ok: false; error: string };

/** What Copy would give: the picture (a data URL) and/or the text, and its cost. */
export type Preview = { png: string | null; text: string | null; tokens: number; output: string };
export type PreviewRequest = { type: "preview" } & Preview;
export type PreviewAsk = { type: "preview:get" };

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
    typeof m?.output === "string"
  );
}

export function isPreviewAsk(message: unknown): message is PreviewAsk {
  return typeOf(message) === "preview:get";
}
