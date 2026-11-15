export const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

export const fmtLat = (v: number, digits = 1) => `${Math.abs(v).toFixed(digits)}° ${v < 0 ? "S" : "N"}`;
export const fmtLon = (v: number, digits = 1) => `${Math.abs(v).toFixed(digits)}° ${v < 0 ? "W" : "E"}`;

const pad = (n: number) => String(n).padStart(2, "0");

export function hhmm(minutes: number) {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function haversine(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLon = (b.lon - a.lon) * toRad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
