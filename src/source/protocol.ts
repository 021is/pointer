// The probe's wire, shared by the page's world (probe.ts) and the extension's (client.ts).
// Events carry JSON strings (objects do not cross between worlds); what arrives is checked.

import type { ComponentInfo } from "../bundle/types";

export const PROBE_ATTR = "data-pointer-probe";
export const ASK = "pointer:probe";
export const ANSWER = "pointer:probe:done";

export type Ask = { id: string };
export type Answer = { id: string; info: ComponentInfo };

/** The parsed message, or an Error saying what was wrong with it. Read by its detail, not by
 *  `instanceof CustomEvent`: an event from a page framed at a screen size is of that frame's realm. */
export function readMessage<T extends { id: string }>(event: Event): T | Error | null {
  const detail = (event as { detail?: unknown }).detail;
  if (typeof detail !== "string") return null;
  try {
    const value = JSON.parse(detail) as unknown;
    if (value && typeof value === "object" && typeof (value as { id?: unknown }).id === "string") {
      return value as T;
    }
    return new Error("a probe message without an id");
  } catch (err) {
    return err instanceof Error ? err : new Error(String(err));
  }
}
