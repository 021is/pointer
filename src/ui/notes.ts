// Pins and their notes, and drawn text: adding a pick or comment with its bubble, editing a
// note or a text, removing a pin. A pick of an element already picked opens that pick: no twins.

import type { Mark, Pin } from "../marks/types";
import type { Point } from "../shared/geometry";
import { openBubble } from "./bubble";
import type { Extension } from "./extension";
import { type State, pinsOf } from "./state";

type TextMark = Extract<Mark, { kind: "text" }>;

export type NotesHost = { root: ShadowRoot; state: State; update: (change: () => void) => void; hooks: () => Extension };

export function notes(host: NotesHost) {
  const { root, state, update } = host;
  const toView = (at: Point) => ({ x: at.x - scrollX, y: at.y - scrollY });

  function removePin(pin: Pin) {
    host.hooks().onRemove(pin);
    update(() => (state.marks = state.marks.filter((m) => m !== pin)));
  }

  /** A comment asks for its words; a pick is the CSS tool and opens its style box (Edvard,
   *  2026-11-18). A note on a pick stays one click away: click its number. */
  async function addPin(kind: Pin["kind"], el: Element, at: Point) {
    const pin: Pin = { kind, color: state.color, el, at, note: "" };
    update(() => state.marks.push(pin));
    if (kind === "pick") return host.hooks().onPick(pin);
    const note = await openBubble(root, {
      at: toView(at),
      placeholder: "Comment",
      hint: "Enter saves · Shift+Enter new line · Esc skips",
    });
    if (!note) return removePin(pin);
    update(() => (pin.note = note));
  }

  async function editNote(pin: Pin, view: Point) {
    const note = await openBubble(root, { at: view, placeholder: "Note", value: pin.note, hint: "Enter saves · Esc keeps it" });
    if (note !== null) update(() => (pin.note = note));
  }

  function pick(el: Element, at: Point) {
    const twin = pinsOf(state.marks).find((p) => p.kind === "pick" && p.el === el);
    if (twin) return host.hooks().onPick(twin);
    void addPin("pick", el, at);
  }

  /** A drawn text, clicked: edit it; emptied, it goes. */
  async function editText(text: TextMark, view: Point) {
    const value = await openBubble(root, { at: view, placeholder: "Text on the page", value: text.text, hint: "Enter saves · Esc keeps it" });
    if (value === null) return;
    update(() => {
      if (value) text.text = value;
      else state.marks = state.marks.filter((m) => m !== text);
    });
  }

  return { addPin, pick, editNote, editText };
}
