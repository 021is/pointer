// Pins and their notes, and drawn text: adding a pick or comment with its bubble, editing a
// note or a text, removing a pin. A pick of an element already picked opens that pick: no twins.

import type { Mark, Pin, PointKind } from "../marks/types";
import { pageToClient, surfaceDoc } from "../screen/surface";
import type { Point } from "../shared/geometry";
import { openBubble } from "./bubble";
import type { Extension } from "./extension";
import { type Framed, type State, pinsOf } from "./state";

type TextMark = Extract<Mark, { kind: "text" }>;

/** The element a comment or an idea belongs to: the one under it; an idea with nothing under it
 *  is about the page itself (the one being marked). */
export const pinTarget = (kind: "comment" | "idea", under: Element | null): Element | null =>
  under ?? (kind === "idea" ? surfaceDoc().body : null);

export type NotesHost = { root: ShadowRoot; state: State; update: (change: () => void) => void; hooks: () => Extension };

/** The note boxes open on the tab, beside the spot: `client` points, page points mapped there. */
export function notes(host: NotesHost) {
  const { root, state, update } = host;

  function removePin(pin: Pin) {
    host.hooks().onRemove(pin);
    update(() => (state.marks = state.marks.filter((m) => m !== pin)));
  }

  /** A comment asks for its words; a pick is the CSS tool and opens its style box (Edvard,
   *  2026-11-18). A note on a pick stays one click away: click its number. An idea's thought is
   *  optional: the idea stays without one, the agent is asked anyway. */
  async function addPin(kind: PointKind, el: Element, at: Point) {
    const pin: Pin = { kind, color: state.color, el, at, note: "" };
    update(() => state.marks.push(pin));
    if (kind === "pick") return host.hooks().onPick(pin);
    const idea = kind === "idea";
    const note = await openBubble(root, {
      at: pageToClient(at),
      placeholder: idea ? "Your thought (optional)" : "Comment",
      hint: idea ? "Enter keeps the idea · Esc keeps it without a thought" : "Enter saves · Shift+Enter new line · Esc skips",
    });
    if (!note) return idea ? undefined : removePin(pin);
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

  /** A box or an ellipse, double-clicked: type on it. Its note moves with it; emptied, it goes;
   *  Esc keeps what it had (Edvard, 2026-11-19). */
  async function editShapeNote(s: Framed, view: Point) {
    const value = await openBubble(root, {
      at: view,
      placeholder: `Text on this ${s.kind}`,
      value: s.note ?? "",
      hint: "Enter saves · empty removes it · Esc keeps it",
    });
    if (value === null) return;
    update(() => {
      if (value) s.note = value;
      else delete s.note;
    });
  }

  return { addPin, pick, editNote, editText, editShapeNote };
}
