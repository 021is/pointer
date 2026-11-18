// What each output of Copy will cost, before copying, so the menu can show it (Edvard,
// 2026-11-18: "when click copy they can select which to copy"). Pure: the regions and the two
// texts in, tokens out. Pictures are priced as Claude prices them (w×h/750), text at about one
// token per 3.3 characters (code-like lines, paths).

import type { Output } from "../ui/state";
import { imageTokens } from "../shared/geometry";
import { type Region, stackRegions } from "./layout";
import { STRIP, wrapLines } from "./strip";

/** The strip's monospace width per character at 14 px. */
const CHAR_PX = 8.4;

export type Costs = Record<Output, number>;

export const textTokens = (text: string) => Math.ceil(text.length / 3.3);

/** A picture's size: the regions stacked, with the strip text under them when given. */
export function pictureSize(regions: readonly Region[], strip: string | null): { w: number; h: number } {
  const lines = (width: number) => (strip ? wrapLines(strip, Math.floor((width - 2 * STRIP.pad) / CHAR_PX)).length : 0);
  const stack = stackRegions(regions, strip === null ? null : lines);
  return { w: stack.width, h: stack.height };
}

/** The three outputs' costs: the picture with its strip, the compact text, the picture alone. */
export function costsOf(regions: readonly Region[] | null, strip: string, text: string): Costs {
  return {
    picture: regions ? imageTokens(pictureSize(regions, strip)) : 0,
    text: textTokens(text),
    image: regions ? imageTokens(pictureSize(regions, null)) : 0,
  };
}
