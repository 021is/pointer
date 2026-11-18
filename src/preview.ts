// The preview page: asks the service worker for the result Copy would give and shows it, with
// buttons to copy the picture or the text from here.

import type { Preview, PreviewAsk } from "./shared/messages";
import type { Output } from "./ui/state";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const LABEL: Record<Output, string> = { picture: "Picture + text", text: "Text only", image: "Picture only" };

function done(message: string) {
  $("done").textContent = message;
}

async function copyPicture(png: string) {
  const blob = await (await fetch(png)).blob();
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  done("Picture copied.");
}

async function show() {
  const ask: PreviewAsk = { type: "preview:get" };
  const p = (await chrome.runtime.sendMessage(ask)) as Preview | null;
  if (!p) {
    $("summary").textContent = "This preview is gone: make a new one from Copy's menu (▾ → Preview in a new tab).";
    return;
  }
  $("summary").textContent = `${LABEL[p.output]} · about ${p.tokens} tokens for your agent.`;
  $("actions").hidden = false;
  const picture = $<HTMLButtonElement>("copy-picture");
  const text = $<HTMLButtonElement>("copy-text");
  if (p.png) {
    const png = p.png;
    $<HTMLImageElement>("picture").src = png;
    $("figure").hidden = false;
    picture.addEventListener("click", () => copyPicture(png).catch((e: unknown) => done(`Copy failed: ${String(e)}`)));
  } else picture.hidden = true;
  if (p.text) {
    const body = p.text;
    $("text").textContent = body;
    $("text-block").hidden = false;
    text.addEventListener("click", () =>
      navigator.clipboard.writeText(body).then(() => done("Text copied."), (e: unknown) => done(`Copy failed: ${String(e)}`)),
    );
  } else text.hidden = true;
}

show().catch((err: unknown) => {
  $("summary").textContent = `The preview could not be shown: ${String(err)}`;
});
