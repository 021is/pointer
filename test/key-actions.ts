// The keyboard edge's actions as the tests give them: every one a spy; Esc finds nothing of
// Pointer's open unless a test says so; [ ] Delete only over a pasted image when asked.
import { vi } from "vitest";
import type { KeyActions } from "../src/ui/keyboard";

export const actions = (overPasted: boolean, open = false): KeyActions => ({
  tool: vi.fn(),
  color: vi.fn(),
  image: vi.fn(),
  undo: vi.fn(),
  redo: vi.fn(),
  copy: vi.fn(),
  escape: vi.fn(() => open),
  close: vi.fn(),
  walk: vi.fn(),
  take: vi.fn(),
  panel: vi.fn(),
  beforePaste: vi.fn(),
  overPasted: () => overPasted,
  canRemove: () => overPasted,
  see: vi.fn(),
  remove: vi.fn(),
  clear: vi.fn(),
});
