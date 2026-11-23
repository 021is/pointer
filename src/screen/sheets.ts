// Marks belong to the page they were made on. The tab's own page (Full) and the framed copy
// (Tablet, Mobile, Custom: one document, resized) are two pages, so each has its own marks: going
// from one to the other puts the marks on screen away, their style edits taken off with them, and
// brings back the other page's. Nothing is thrown away by switching (Edvard: the marks are his
// work); the framed page's marks live as long as its frame (stage.ts keeps a frame with marks).

import type { Mark, Pin } from "../marks/types";
import { type State, pinsOf } from "../ui/state";

export type SheetsHost = {
  state: State;
  /** Takes the pins' style edits off their elements; the function returned puts them back. */
  park: (pins: Pin[]) => () => void;
  /** Undo and Redo start afresh: their steps were the other page's marks. */
  restart: () => void;
};

type Sheet = { marks: Mark[]; restore: () => void };

export type Sheets = {
  /** The marks on screen go away; the other page's come back (none, the first time). */
  swap: () => void;
  /** The marks put away: the other page's. */
  away: () => readonly Mark[];
  /** The page put away is gone (its frame closed): so are its marks. */
  dropAway: () => void;
};

export function createSheets(h: SheetsHost): Sheets {
  let away: Sheet | null = null;
  return {
    swap() {
      const leaving: Sheet = { marks: h.state.marks, restore: h.park(pinsOf(h.state.marks)) };
      const back = away;
      h.state.marks = back?.marks ?? [];
      back?.restore();
      away = leaving;
      h.restart();
    },
    away: () => away?.marks ?? [],
    dropAway() {
      away = null;
    },
  };
}
