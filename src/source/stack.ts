// React 19 keeps, in dev builds, the stack of where each element's JSX ran (`_debugStack`). These
// pure helpers read Chrome's stack text and drop React's and the bundler's own frames.

export type Frame = { fn: string; url: string; line: number; column: number };

const FRAME = /^\s*at (?:(.*?) \()?(.+?):(\d+):(\d+)\)?\s*$/;

/** Chrome's `Error.stack` text → frames; the message line and odd lines are skipped. */
export function parseStack(stack: string): Frame[] {
  const frames: Frame[] = [];
  for (const raw of stack.split("\n")) {
    const m = raw.match(FRAME);
    if (!m) continue;
    const [, fn = "", url = "", line = "0", column = "0"] = m;
    frames.push({ fn: fn.replace(/^async /, ""), url, line: Number(line), column: Number(column) });
  }
  return frames;
}

/** Frames of the runtime, never the app's code: React, its JSX helpers, bundler runtimes. */
const INTERNAL_URL =
  /\/node_modules\/|react-dom|react-jsx|jsx-dev-runtime|next\/dist|turbopack-runtime|\[turbopack\]|<anonymous>|^native$|chrome-extension:/;
const INTERNAL_FN = /^(exports\.)?(jsxDEV|jsxs?|createElement|react-stack-bottom-frame|Object\.react-stack-bottom-frame)$/;

/** The frames that may be the app's own code, outermost runtime frames dropped, in order. */
export function appFrames(frames: readonly Frame[]): Frame[] {
  return frames.filter((f) => !INTERNAL_URL.test(f.url) && !INTERNAL_FN.test(f.fn));
}

/**
 * A source path as a repo-relative file: bundler prefixes stripped
 * ("turbopack:///[project]/src/a.tsx" → "src/a.tsx", "webpack://_N_E/./src/a.tsx" → "src/a.tsx").
 */
export function cleanSourcePath(path: string): string {
  let p = path.replace(/[?#].*$/, "");
  p = p.replace(/^turbopack:\/\/\/?/, "").replace(/^\[project\]\//, "");
  p = p.replace(/^webpack:\/\/[^/]*\//, "").replace(/^webpack-internal:\/\/\/(\([^)]*\)\/)?/, "");
  p = p.replace(/^file:\/\/\/?/, "/");
  p = p.replace(/^https?:\/\/[^/]+\//, "");
  p = p.replace(/^(\.\/)+/, "");
  return p;
}

/** A dependency, never the file to change. */
export function isDependency(path: string): boolean {
  return /(^|\/)node_modules\//.test(path) || /^(react|react-dom|next)\//.test(path);
}
