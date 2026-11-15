import type { Area } from "@/lib/area";
import { capitalize, haversine, hhmm } from "@/lib/format";
import { inBbox } from "@/lib/geo/world";
import { FIRST_YEAR, MONTHS } from "@/lib/period";
import { type Cluster, type Dataset, MATCHING_RULE, REGIONS, type ViirsClass, thresholds as regionThresholds } from "./dataset";

export const thresholds = (mi: number) => regionThresholds(mi, FIRST_YEAR);

export function inArea(area: Area | null, p: { lon: number; lat: number; country: string }) {
  if (!area) return true;
  return area.kind === "country" ? p.country === area.name : inBbox(area.bbox, p.lon, p.lat);
}

export interface MonthStats {
  harmonized: number;
  modis: number;
  viirs: number;
  pairs: number;
  modisOnly: number;
  viirsOnly: number;
  aqua: number;
  aquaPaired: number;
  terra: number;
  terraPaired: number;
  viirsPaired: number;
  byCountry: Record<string, number>;
  byRegion: Record<number, number>;
}

export function statsFor(ds: Dataset, mi: number, area: Area | null): MonthStats {
  const t = thresholds(mi);
  const s: MonthStats = {
    harmonized: 0, modis: 0, viirs: 0, pairs: 0, modisOnly: 0, viirsOnly: 0,
    aqua: 0, aquaPaired: 0, terra: 0, terraPaired: 0, viirsPaired: 0, byCountry: {}, byRegion: {},
  };
  for (const c of ds.clusters) {
    if (c.u >= t[c.r] || !inArea(area, c)) continue;
    s.harmonized++;
    s.viirs += c.viirs.length;
    s.byCountry[c.country] = (s.byCountry[c.country] ?? 0) + 1;
    s.byRegion[c.r] = (s.byRegion[c.r] ?? 0) + 1;
    if (c.modis) {
      s.modis++; s.aqua++; s.aquaPaired++;
      s.pairs += c.viirs.length;
      s.viirsPaired += c.viirs.length;
    } else {
      s.viirsOnly++;
    }
  }
  for (const m of ds.solo) {
    if (m.u >= t[m.r] || !inArea(area, m)) continue;
    s.modis++; s.modisOnly++; s.harmonized++;
    if (m.sat === "Aqua") s.aqua++;
    else s.terra++;
    s.byCountry[m.country] = (s.byCountry[m.country] ?? 0) + 1;
  }
  return s;
}

export function densityPoints(ds: Dataset, mi: number) {
  const t = thresholds(mi);
  const points: { lat: number; lng: number; w: number }[] = [];
  for (const c of ds.clusters) if (c.u < t[c.r]) points.push({ lat: c.lat, lng: c.lon, w: c.viirs.length + (c.modis ? 1 : 0) });
  for (const m of ds.solo) if (m.u < t[m.r]) points.push({ lat: m.lat, lng: m.lon, w: 1 });
  return points;
}

export function busiestRegion(ds: Dataset, mi: number, area: Area | null, stats: MonthStats) {
  const best = Object.entries(stats.byRegion).sort((a, b) => b[1] - a[1])[0];
  if (!best) return null;
  const r = Number(best[0]);
  const t = thresholds(mi);
  let viirs = 0;
  let modis = 0;
  for (const c of ds.clusters) {
    if (c.r !== r || c.u >= t[r] || !inArea(area, c)) continue;
    viirs += c.viirs.length;
    if (c.modis) modis++;
  }
  const { name, lon, lat } = REGIONS[r];
  return { name, lon, lat, harmonized: best[1], viirs, modis };
}

export interface RecordDetail {
  date: string;
  status: string;
  rows: { source: string; sensor: "MODIS" | "VIIRS"; time: string; confidence: string; frp: number }[];
  farthestKm: number;
  spreadMinutes: number;
  calibratedFrp: number | null;
}

export function recordDetail(c: Cluster, mi: number): RecordDetail {
  const day = 1 + (Math.abs(Math.round(c.lon * 7 + c.lat * 3)) % 27);
  const all = [...(c.modis ? [c.modis] : []), ...c.viirs];
  let farthestKm = 0;
  for (const a of all) for (const b of all) farthestKm = Math.max(farthestKm, haversine(a, b));
  const times = all.map((p) => p.t);
  const viirsSum = c.viirs.reduce((sum, v) => sum + v.frp, 0);
  return {
    date: `${day} ${MONTHS[mi % 12]} ${FIRST_YEAR + Math.floor(mi / 12)}`,
    status: c.modis ? "Potentially corresponding" : "Seen by VIIRS only",
    rows: all.map((p) => ({
      source: `${p.sensor} ${p.sat}`,
      sensor: p.sensor,
      time: hhmm(p.t),
      confidence: p.sensor === "MODIS" ? `${p.conf}%` : capitalize(p.conf),
      frp: p.frp,
    })),
    farthestKm,
    spreadMinutes: Math.round(Math.max(...times) - Math.min(...times)),
    calibratedFrp: c.modis ? viirsSum * 0.97 : null,
  };
}

const median = (values: number[]) =>
  values.length ? [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] : 0;

const histogram = (values: number[], max: number, bins: number) => {
  const out = new Array<number>(bins).fill(0);
  for (const v of values) out[Math.min(bins - 1, Math.floor((v / max) * bins))]++;
  return out;
};

export interface Comparison {
  pairs: number;
  distanceBins: number[];
  medianKm: number;
  timeBins: number[];
  medianMinutes: number;
  frp: [number, number][];
  modisConfidenceBins: number[];
  viirsConfidence: Record<ViirsClass, number>;
}

export function comparisonFor(ds: Dataset, mi: number, area: Area | null): Comparison {
  const t = thresholds(mi);
  const km: number[] = [];
  const minutes: number[] = [];
  const frp: [number, number][] = [];
  const modisConfidence: number[] = [];
  const viirsConfidence: Record<ViirsClass, number> = { low: 0, nominal: 0, high: 0 };
  for (const c of ds.clusters) {
    if (c.u >= t[c.r] || !inArea(area, c)) continue;
    for (const v of c.viirs) viirsConfidence[v.conf]++;
    if (!c.modis) continue;
    modisConfidence.push(c.modis.conf);
    frp.push([c.viirs.reduce((sum, v) => sum + v.frp, 0), c.modis.frp]);
    for (const v of c.viirs) {
      km.push(haversine(c.modis, v));
      minutes.push(Math.abs(c.modis.t - v.t));
    }
  }
  for (const m of ds.solo) if (m.u < t[m.r] && inArea(area, m)) modisConfidence.push(m.conf);
  return {
    pairs: km.length,
    distanceBins: histogram(km, MATCHING_RULE.maxKm, 15),
    medianKm: median(km),
    timeBins: histogram(minutes, MATCHING_RULE.maxMinutes, 10),
    medianMinutes: median(minutes),
    frp: frp.slice(0, 900),
    modisConfidenceBins: histogram(modisConfidence, 101, 10),
    viirsConfidence,
  };
}

export { median };
