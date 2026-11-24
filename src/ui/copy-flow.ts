// What happens around Copy: nothing marked says so, a copy confirms on the button with what it
// cost, "clear after copy" starts fresh with an Undo, and the preview opens the very result in a
// tab of Pointer's own (nothing touches the clipboard then).

import { buildBundle, copyBundle, estimateCosts } from "../capture/copy";
import { textTokens } from "../capture/estimate";
import { imageTokens } from "../shared/geometry";
import type { PreviewReply, PreviewRequest } from "../shared/messages";
import type { Extension } from "./extension";
import { type Output, type State, isEmpty } from "./state";
import type { Toast } from "./toast";

export type CopyHost = {
  state: State;
  host: HTMLElement;
  hooks: () => Extension;
  say: Toast["say"];
  flash: (message: string) => void;
  update: (change: () => void) => void;
  setOutput: (o: Output) => void;
  /** Clear everything with Undo (history.ts). */
  clear: (message: string) => void;
};

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** "3 marks · ≈140 tok": what the button says after a copy. */
export function copiedLabel(marks: number, tokens: number): string {
  return `Copied · ${marks} ${marks === 1 ? "mark" : "marks"} · ≈${tokens} tok`;
}

export function copyFlow(h: CopyHost) {
  const ctx = () => ({ state: h.state, host: h.host, changesOf: h.hooks().changesOf });

  function copy() {
    if (isEmpty(h.state.marks) && h.state.output === "text") {
      return h.say("Nothing marked yet: comment, pick or crop something first.");
    }
    const marks = h.state.marks.length;
    copyBundle(ctx()).then(
      ({ text, image, note }) => {
        h.flash(copiedLabel(marks, image ? imageTokens(image) : textTokens(text)));
        // A note (a crop only partly in the picture) is said plainly, with the clear's when both.
        if (h.state.clearAfterCopy) h.clear(note ? `${note} Cleared for the next round.` : "Cleared for the next round.");
        else if (note) h.say(note);
      },
      (err: unknown) => h.say(`Copy failed: ${errorText(err)}`, "error"),
    );
  }

  function copyAs(o: Output) {
    h.setOutput(o);
    copy();
  }

  async function preview() {
    try {
      const { text, image } = buildBundle(ctx());
      const pic = await image;
      const png = pic ? await blobToDataUrl(pic.blob) : null;
      const body = (await text) ?? null;
      const tokens = pic ? imageTokens(pic.size) : textTokens(body ?? "");
      const ask: PreviewRequest = { type: "preview", png, text: body, tokens, output: h.state.output };
      const answer = (await chrome.runtime.sendMessage(ask)) as PreviewReply | undefined;
      if (!answer) throw new Error("the extension did not answer (reload it in chrome://extensions)");
      if (!answer.ok) throw new Error(answer.error);
      if (pic?.note) h.say(pic.note);
    } catch (err) {
      h.say(`The preview did not open: ${errorText(err)}`, "error");
    }
  }

  return { copy, copyAs, preview, estimate: () => estimateCosts(ctx()) };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("the picture could not be read"));
    reader.readAsDataURL(blob);
  });
}
