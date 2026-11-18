// The one message between the content script and the service worker: take the screenshot.

export type CaptureRequest = { type: "capture" };
export type CaptureReply = { ok: true; dataUrl: string } | { ok: false; error: string };

export function isCaptureRequest(message: unknown): message is CaptureRequest {
  return (message as { type?: unknown } | null)?.type === "capture";
}
