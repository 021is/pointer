// The code rules' 300-line cap, for every tracked source and Markdown file.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const MAX = 300;
const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
  encoding: "utf8",
})
  .split("\n")
  .filter((f) => /\.(ts|mjs|md|json|yml)$/.test(f) && !f.endsWith("package-lock.json"));

const long = files
  .map((f) => ({ f, n: readFileSync(f, "utf8").split("\n").length }))
  .filter(({ n }) => n > MAX);

for (const { f, n } of long) console.error(`${f}: ${n} lines (max ${MAX})`);
if (long.length > 0) process.exit(1);
console.log(`lines: ${files.length} files, all within ${MAX}`);
