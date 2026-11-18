// Computed colours → #hex. Chrome reports Tailwind 4's colours as lab()/oklch(), which cost an
// agent more tokens and match nothing in the code; hex is short and comparable. Out-of-gamut
// colours are clipped to sRGB (close enough to say what is on screen). Pure.

type Rgb = [number, number, number];

/** A 0–255 channel as exactly two hex digits: clamped, so 300 is "ff", never "12c". */
export const byteHex = (v: number) =>
  Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0");

/** A 0–1 channel (clipped into sRGB) as two hex digits. */
const unitHex = (v: number) => byteHex(v * 255);

function gamma(c: number): number {
  const a = Math.abs(c);
  const v = a <= 0.0031308 ? 12.92 * a : 1.055 * a ** (1 / 2.4) - 0.055;
  return Math.sign(c) * v;
}

/** CSS Color 4: oklab → linear sRGB. */
function oklabToLinear(L: number, a: number, b: number): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** CSS Color 4: CIE Lab (D50) → XYZ D50 → linear sRGB. */
function labToLinear(L: number, a: number, b: number): Rgb {
  const k = 24389 / 27;
  const e = 216 / 24389;
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const x = (fx ** 3 > e ? fx ** 3 : (116 * fx - 16) / k) * 0.3457 / 0.3585;
  const y = L > k * e ? fy ** 3 : L / k;
  const z = (fz ** 3 > e ? fz ** 3 : (116 * fz - 16) / k) * (1 - 0.3457 - 0.3585) / 0.3585;
  return [
    3.1341359569958707 * x - 1.6173863321612538 * y - 0.4906619460083532 * z,
    -0.978795502912089 * x + 1.916254567259524 * y + 0.03344273116131949 * z,
    0.07195537988411677 * x - 0.2289768264158322 * y + 1.405386058324125 * z,
  ];
}

const FN = /^(lab|oklab|lch|oklch)\(\s*([^)]*?)\s*\)$/;

function num(token: string | undefined, percentOf: number): number {
  if (!token || token === "none") return 0;
  if (token.endsWith("%")) return (Number(token.slice(0, -1)) / 100) * percentOf;
  return Number.parseFloat(token);
}

/** lab() / oklab() / lch() / oklch() → #rrggbb(aa), or null when it is none of them. */
export function cssColorToHex(color: string): string | null {
  const m = color.trim().match(FN);
  if (!m) return null;
  const [, fn = "", body = ""] = m;
  const [channels = "", alphaPart] = body.split("/");
  const [c1, c2, c3] = channels.trim().split(/\s+/);
  const ok = fn.startsWith("ok");
  const L = num(c1, ok ? 1 : 100);
  let a = num(c2, ok ? 0.4 : 125);
  let b = num(c3, ok ? 0.4 : 125);
  if (fn.endsWith("lch")) {
    const chroma = num(c2, ok ? 0.4 : 150);
    const hue = (Number.parseFloat(c3 ?? "0") * Math.PI) / 180;
    a = chroma * Math.cos(hue);
    b = chroma * Math.sin(hue);
  }
  const linear = ok ? oklabToLinear(L, a, b) : labToLinear(L, a, b);
  if (linear.some((v) => Number.isNaN(v))) return null;
  const rgb = `#${linear.map((v) => unitHex(gamma(v))).join("")}`;
  const alpha = alphaPart === undefined ? 1 : num(alphaPart.trim(), 1);
  return alpha >= 1 ? rgb : `${rgb}${unitHex(alpha)}`;
}
