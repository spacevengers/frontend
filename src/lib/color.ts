export const MAGMA = ["#1B0B33", "#4A1265", "#8E1F6E", "#D2344F", "#F5702A", "#FFB833", "#FFF1B8"] as const;

const rgb = (hex: string) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));

export function ramp(stops: readonly string[], t: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  const a = rgb(stops[i]);
  const b = rgb(stops[i + 1]);
  return [0, 1, 2].map((k) => Math.round(a[k] + (b[k] - a[k]) * f)) as [number, number, number];
}

export const rampCss = (stops: readonly string[], t: number) => `rgb(${ramp(stops, t).join(",")})`;

export const luminance = ([r, g, b]: [number, number, number]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

const DENSITY_STOPS = [1, 6, 14, 28, 50, 80];
export function densityColor(n: number) {
  let i = 0;
  while (i < DENSITY_STOPS.length - 2 && n > DENSITY_STOPS[i + 1]) i++;
  const lo = DENSITY_STOPS[i];
  const hi = DENSITY_STOPS[i + 1];
  const f = Math.min(1, Math.max(0, (n - lo) / (hi - lo)));
  return rampCss([MAGMA[i + 1], MAGMA[i + 2]], f);
}
