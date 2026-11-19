// The content script. Injected on every click of the icon (or its shortcut): the first time it
// opens Pointer, after that it turns it on and off, keeping what was drawn and edited.

import { createPanel } from "../panel/panel";
import { type App, createApp } from "./app";

declare global {
  interface Window {
    __pointer?: App;
  }
}

if (window.__pointer) {
  window.__pointer.toggle();
} else {
  const app = createApp(createPanel);
  window.__pointer = app;
  app.open();
}
