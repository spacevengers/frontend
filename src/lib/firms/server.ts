import "server-only";

// Downloads NASA's public "last 24 hours" FIRMS files and pairs MODIS with VIIRS detections.
// These files need no API key. The URLs are fixed: nothing a visitor sends reaches a URL here.
// https://firms.modaps.eosdis.nasa.gov/active_fire/

import { MATCHING_RULE } from "@/lib/matching-rule";
import { LIVE_MAX_MINUTES, type LiveFirms, type LiveModisRow, type LiveSource, type LiveViirsRow } from "./types";

const BASE = "https://firms.modaps.eosdis.nasa.gov/data/active_fire";
const FILES = [
  { name: "MODIS Terra and Aqua, 1 km (C6.1 NRT)", sensor: "MODIS", url: `${BASE}/modis-c6.1/csv/MODIS_C6_1_Global_24h.csv` },
  { name: "VIIRS S-NPP, 375 m (C2 NRT)", sensor: "VIIRS", url: `${BASE}/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Global_24h.csv` },
  { name: "VIIRS NOAA-20, 375 m (C2 NRT)", sensor: "VIIRS", url: `${BASE}/noaa-20-viirs-c2/csv/J1_VIIRS_C2_Global_24h.csv` },
  { name: "VIIRS NOAA-21, 375 m (C2 NRT)", sensor: "VIIRS", url: `${BASE}/noaa-21-viirs-c2/csv/J2_VIIRS_C2_Global_24h.csv` },
] as const;

const MAX_BYTES = 40 * 1024 * 1024;
const TTL_MS = 30 * 60 * 1000;

const VIIRS_SAT: Record<string, number> = { N: 0, "1": 1, N20: 1, "2": 2, N21: 2 };
const MODIS_SAT: Record<string, number> = { T: 0, Terra: 0, A: 1, Aqua: 1 };
const VIIRS_CLASS: Record<string, number> = { l: 0, low: 0, n: 1, nominal: 1, h: 2, high: 2 };

interface Row {
  lon: number;
  lat: number;
  t: number;
  frp: number;
  sat: string;
  conf: string;
}

async function download(url: string): Promise<{ text: string; updated: string | null }> {
  const response = await fetch(url, { signal: AbortSignal.timeout(45_000), cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (Number(response.headers.get("content-length") ?? 0) > MAX_BYTES) throw new Error("file too large");
  const text = await response.text();
  if (text.length > MAX_BYTES) throw new Error("file too large");
  return { text, updated: response.headers.get("last-modified") };
}

function parse(text: string): Row[] {
  const lines = text.split("\n");
  const header = lines[0]?.trim().split(",") ?? [];
  const [iLat, iLon, iDate, iTime, iSat, iConf, iFrp] = ["latitude", "longitude", "acq_date", "acq_time", "satellite", "confidence", "frp"].map((name) =>
    header.indexOf(name),
  );
  if ([iLat, iLon, iDate, iTime, iSat, iConf, iFrp].some((i) => i < 0)) return [];

  const rows: Row[] = [];
  for (let k = 1; k < lines.length; k++) {
    const f = lines[k].split(",");
    if (f.length < header.length) continue;
    const lat = Number(f[iLat]);
    const lon = Number(f[iLon]);
    const [y, m, d] = f[iDate].split("-").map(Number);
    const hhmm = f[iTime].padStart(4, "0");
    const t = Date.UTC(y, m - 1, d, Number(hhmm.slice(0, 2)), Number(hhmm.slice(2))) / 60_000;
    const frp = Number(f[iFrp]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(t) || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    rows.push({ lon, lat, t, frp: Number.isFinite(frp) ? frp : 0, sat: f[iSat].trim(), conf: f[iConf].trim() });
  }
  return rows;
}

const RAD = Math.PI / 180;
function km(aLon: number, aLat: number, bLon: number, bLat: number) {
  const dLat = (bLat - aLat) * RAD;
  const dLon = (bLon - aLon) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * RAD) * Math.cos(bLat * RAD) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

const round = (v: number, places: number) => Math.round(v * 10 ** places) / 10 ** places;

async function build(): Promise<LiveFirms> {
  const results = await Promise.allSettled(FILES.map((f) => download(f.url)));
  const sources: LiveSource[] = [];
  const modisRows: Row[] = [];
  const viirsRows: Row[] = [];
  results.forEach((result, i) => {
    const file = FILES[i];
    const rows = result.status === "fulfilled" ? parse(result.value.text) : [];
    sources.push({
      name: file.name,
      url: file.url,
      rows: rows.length,
      updated: result.status === "fulfilled" ? result.value.updated : null,
      ok: result.status === "fulfilled",
    });
    for (const row of rows) (file.sensor === "MODIS" ? modisRows : viirsRows).push(row);
  });
  if (!sources.some((s) => s.ok)) throw new Error("NASA FIRMS did not answer");

  const CELL = 0.02;
  const key = (latCell: number, lonCell: number) => (latCell + 5000) * 40000 + (lonCell + 10000);
  const cells = new Map<number, number[]>();
  viirsRows.forEach((v, i) => {
    const k = key(Math.floor(v.lat / CELL), Math.floor(v.lon / CELL));
    const bucket = cells.get(k);
    if (bucket) bucket.push(i);
    else cells.set(k, [i]);
  });

  let base = Number.POSITIVE_INFINITY;
  for (const r of modisRows) base = Math.min(base, r.t);
  for (const r of viirsRows) base = Math.min(base, r.t);
  if (!Number.isFinite(base)) base = Date.now() / 60_000;

  const viirsMinutes = new Float64Array(viirsRows.length).fill(-1);
  const links: [number, number, number][] = [];
  const reachDegrees = MATCHING_RULE.maxKm / 111;

  const modis: LiveModisRow[] = modisRows.map((m, mi) => {
    const latCell = Math.floor(m.lat / CELL);
    const lonCell = Math.floor(m.lon / CELL);
    const lonReach = Math.min(40, Math.ceil(reachDegrees / Math.max(0.05, Math.cos(m.lat * RAD)) / CELL));
    let partners = 0;
    let nearestKm = -1;
    let nearestMinutes = -1;
    for (let a = latCell - 1; a <= latCell + 1; a++) {
      for (let b = lonCell - lonReach; b <= lonCell + lonReach; b++) {
        for (const vi of cells.get(key(a, b)) ?? []) {
          const v = viirsRows[vi];
          const minutes = Math.abs(v.t - m.t);
          if (minutes > LIVE_MAX_MINUTES) continue;
          const distance = km(m.lon, m.lat, v.lon, v.lat);
          if (distance > MATCHING_RULE.maxKm) continue;
          partners++;
          links.push([mi, vi, minutes]);
          if (viirsMinutes[vi] < 0 || minutes < viirsMinutes[vi]) viirsMinutes[vi] = minutes;
          if (nearestMinutes < 0 || minutes < nearestMinutes) {
            nearestKm = distance;
            nearestMinutes = minutes;
          }
        }
      }
    }
    return [round(m.lon, 5), round(m.lat, 5), m.t - base, round(m.frp, 1), Number(m.conf) || 0, MODIS_SAT[m.sat] ?? 0, partners, round(nearestKm, 2), nearestMinutes];
  });

  const viirs: LiveViirsRow[] = viirsRows.map((v, i) => [
    round(v.lon, 5),
    round(v.lat, 5),
    v.t - base,
    round(v.frp, 1),
    VIIRS_CLASS[v.conf.toLowerCase()] ?? 1,
    VIIRS_SAT[v.sat] ?? 0,
    viirsMinutes[i],
  ]);

  return {
    generatedAt: new Date().toISOString(),
    baseTime: new Date(base * 60_000).toISOString(),
    rule: { maxKm: MATCHING_RULE.maxKm, maxMinutes: MATCHING_RULE.maxMinutes, widestMinutes: LIVE_MAX_MINUTES },
    sources,
    modis,
    viirs,
    links,
  };
}

let cached: { at: number; data: Promise<LiveFirms> } | undefined;

export function latestFirms(): Promise<LiveFirms> {
  if (!cached || Date.now() - cached.at > TTL_MS) {
    const data = build();
    cached = { at: Date.now(), data };
    data.catch(() => {
      if (cached?.data === data) cached = undefined;
    });
  }
  return cached.data;
}
