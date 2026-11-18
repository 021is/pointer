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

/**
 * Code that is not the app's: packages (also as a bundler names their chunks,
 * "node_modules_react-dom_…js") and the bundlers' runtimes. One rule, for a chunk URL or a
 * source path alike.
 */
const DEPENDENCY =
  /(^|\/)node_modules\/|^(react|react-dom|next)\/|react-dom|react-jsx|jsx-dev-runtime|next\/dist|turbopack-runtime|\[turbopack\]/;
/** Frames with no file behind them at all. */
const NO_FILE = /<anonymous>|^native$|chrome-extension:/;
const RUNTIME_FN = /^(exports\.)?(jsxDEV|jsxs?|createElement|react-stack-bottom-frame|Object\.react-stack-bottom-frame)$/;

/** A dependency, never the file to change. */
export function isDependency(path: string): boolean {
  return DEPENDENCY.test(path);
}

/** The frames that may be the app's own code, runtime frames dropped, in order. */
export function appFrames(frames: readonly Frame[]): Frame[] {
  return frames.filter((f) => !isDependency(f.url) && !NO_FILE.test(f.url) && !RUNTIME_FN.test(f.fn));
}

/**
 * A source path as a repo-relative file: bundler prefixes stripped
 * ("turbopack:///[project]/src/a.tsx" → "src/a.tsx", "webpack://_N_E/./src/a.tsx" → "src/a.tsx"),
 * and an absolute path cut to its `src/` (fewer tokens, and no home folder in a chat).
 */
export function cleanSourcePath(path: string): string {
  let p = path.replace(/[?#].*$/, "");
  p = p.replace(/^turbopack:\/\/\/?/, "").replace(/^\[project\]\//, "");
  p = p.replace(/^webpack:\/\/[^/]*\//, "").replace(/^webpack-internal:\/\/\/(\([^)]*\)\/)?/, "");
  p = p.replace(/^file:\/\/\/?/, "/");
  p = p.replace(/^https?:\/\/[^/]+\//, "");
  p = p.replace(/^(\.\/)+/, "");
  const src = p.startsWith("/") ? p.indexOf("/src/") : -1;
  return src >= 0 ? p.slice(src + 1) : p;
}
