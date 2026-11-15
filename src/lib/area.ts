import { fmtLat, fmtLon } from "@/lib/format";
import { type AreaGeometry, type Bbox, bboxPolygon, type World } from "@/lib/geo/world";

export type Area =
  | { kind: "bbox"; bbox: Bbox; geometry: AreaGeometry }
  | { kind: "country"; name: string; bbox: Bbox; geometry: AreaGeometry };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function parseBbox(value: string | null | undefined): Bbox | null {
  if (!value) return null;
  const parts = value.split(",").map((p) => (p.trim() === "" ? Number.NaN : Number(p)));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const w = clamp(parts[0], -180, 180);
  const s = clamp(parts[1], -85, 85);
  const e = clamp(parts[2], -180, 180);
  const n = clamp(parts[3], -85, 85);
  if (w >= e || s >= n) return null;
  return [w, s, e, n].map((x) => Math.round(x * 100) / 100) as Bbox;
}

export function resolveArea(view: { bbox: Bbox | null; country: string | null }, world: World): Area | null {
  if (view.country) {
    const c = world.byName.get(view.country);
    return c ? { kind: "country", name: c.name, bbox: c.bbox, geometry: c.feature.geometry } : null;
  }
  return view.bbox ? { kind: "bbox", bbox: view.bbox, geometry: bboxPolygon(view.bbox) } : null;
}

export function areaLabel(area: Area | null) {
  if (!area) return "Whole world";
  if (area.kind === "country") return area.name;
  const [w, s, e, n] = area.bbox;
  return `${fmtLat(s)} to ${fmtLat(n)}, ${fmtLon(w)} to ${fmtLon(e)}`;
}
