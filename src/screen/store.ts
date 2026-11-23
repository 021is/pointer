// The custom screen size, remembered (Edvard, 2026-11-23): Pointer's only use of
// chrome.storage.local, two numbers under one key, never synced, never sent anywhere. Read back
// through readSaved: what comes out of storage is checked like anything else that enters.

import type { Size } from "../shared/geometry";
import { readSaved } from "./sizes";

const KEY = "screen:custom";

/** The saved custom size, or null when none was saved; rejects with the cause when unreadable. */
export async function loadCustom(): Promise<Size | null> {
  const value = (await chrome.storage.local.get(KEY))[KEY];
  if (value === undefined) return null;
  const size = readSaved(value);
  if (!size) throw new Error("the saved custom size is not a size Pointer can use");
  return size;
}

export async function saveCustom(size: Size): Promise<void> {
  await chrome.storage.local.set({ [KEY]: { w: size.w, h: size.h } });
}
