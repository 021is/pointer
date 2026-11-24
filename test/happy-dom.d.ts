// happy-dom's own controls (setViewport and the rest), there on `window` in every happy-dom test.
import type { DetachedWindowAPI } from "happy-dom";

declare global {
  interface Window {
    happyDOM: DetachedWindowAPI;
  }
}
