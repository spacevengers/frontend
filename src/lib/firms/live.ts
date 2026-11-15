"use client";

import { useEffect, useMemo, useState } from "react";
import type { Feature, FeatureCollection, LineString, Point } from "geojson";
import type { Area } from "@/lib/area";
import { haversine } from "@/lib/format";
import { LIVE_MODIS_SATS, LIVE_VIIRS_CLASSES, LIVE_VIIRS_SATS, type LiveFirms, type LiveModisRow, type LiveViirsRow } from "./types";

export type LivePointProperties = { id: string; sensor: "MODIS" | "VIIRS"; sat: string; frp: number; confp?: number; conf?: string; dt: number };
export type LiveLinkProperties = { dt: number };
export type LivePoints = FeatureCollection<Point, LivePointProperties>;
export type LiveLinks = FeatureCollection<LineString, LiveLinkProperties>;
export type LiveGeoJSON = { points: LivePoints; links: LiveLinks };
export const EMPTY_LIVE_GEOJSON: LiveGeoJSON = {
  points: { type: "FeatureCollection", features: [] },
  links: { type: "FeatureCollection", features: [] },
};

type LoadState = { data: LiveFirms | null; error: string | null; loading: boolean; retry: () => void };
const REFRESH_MS = 30 * 60 * 1000;
const SOURCE_STALE_MS = 24 * 60 * 60 * 1000;

export function isLiveSourceStale(updated: string | null) {
  if (!updated) return false;
  const updatedAt = Date.parse(updated);
  return Number.isFinite(updatedAt) && Date.now() - updatedAt > SOURCE_STALE_MS;
}

export function useLiveFirms(enabled: boolean): LoadState {
  const [state, setState] = useState<Omit<LoadState, "retry">>({ data: null, error: null, loading: false });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let inFlight = false;
    const controller = new AbortController();
    const refresh = async () => {
      if (inFlight) return;
      inFlight = true;
      setState((current) => ({ ...current, loading: true, error: null }));
      try {
        const response = await fetch("/api/firms/latest", { signal: controller.signal });
        if (!response.ok) {
          const body = await response.json().catch(() => null) as { error?: string } | null;
          throw new Error(body?.error ?? `FIRMS request failed (${response.status})`);
        }
        const data = await response.json() as LiveFirms;
        if (active) setState({ data, error: null, loading: false });
      } catch (error) {
        if (active && !controller.signal.aborted) {
          setState((current) => ({ ...current, error: error instanceof Error ? error.message : "Could not load NASA FIRMS data.", loading: false }));
        }
      } finally {
        inFlight = false;
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
      controller.abort();
    };
  }, [enabled, attempt]);

  return { ...state, retry: () => setAttempt((current) => current + 1) };
}

export function liveGeoJSON(raw: LiveFirms): LiveGeoJSON {
  const pointFeatures: Feature<Point, LivePointProperties>[] = [
    ...raw.modis.map((row, index) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [row[0], row[1]] as [number, number] },
      properties: { id: `M${index}`, sensor: "MODIS" as const, sat: LIVE_MODIS_SATS[row[5]] ?? "Terra", frp: row[3], confp: row[4], dt: row[8] < 0 ? 9999 : row[8] },
    })),
    ...raw.viirs.map((row, index) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [row[0], row[1]] as [number, number] },
      properties: { id: `V${index}`, sensor: "VIIRS" as const, sat: LIVE_VIIRS_SATS[row[5]] ?? "S-NPP", frp: row[3], conf: LIVE_VIIRS_CLASSES[row[4]] ?? "nominal", dt: row[6] < 0 ? 9999 : row[6] },
    })),
  ];
  const links: Feature<LineString, LiveLinkProperties>[] = raw.links.map(([modisIndex, viirsIndex, dt]) => {
    const modis = raw.modis[modisIndex];
    const viirs = raw.viirs[viirsIndex];
    return {
      type: "Feature",
      geometry: { type: "LineString", coordinates: [[modis[0], modis[1]], [viirs[0], viirs[1]]] },
      properties: { dt },
    };
  });
  return {
    points: { type: "FeatureCollection", features: pointFeatures },
    links: { type: "FeatureCollection", features: links },
  };
}

function insideRing(point: [number, number], ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > point[1]) !== (yj > point[1]) && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function insideArea(lon: number, lat: number, area: Area | null) {
  if (!area) return true;
  const [west, south, east, north] = area.bbox;
  if (lon < west || lon > east || lat < south || lat > north) return false;
  if (area.kind === "bbox") return true;
  const point: [number, number] = [lon, lat];
  const polygons = area.geometry.type === "Polygon" ? [area.geometry.coordinates] : area.geometry.coordinates;
  return polygons.some((rings) => insideRing(point, rings[0]) && !rings.slice(1).some((ring) => insideRing(point, ring)));
}

function median(values: number[]) {
  if (!values.length) return null;
  values.sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
}

export interface LiveStats {
  modis: number;
  viirs: number;
  pairedModis: number;
  pairedViirs: number;
  pairs: number;
  modisBySatellite: { satellite: string; count: number; paired: number }[];
  viirsBySatellite: { satellite: string; count: number; paired: number }[];
  medianKm: number | null;
  medianMinutes: number | null;
}

export function liveStats(raw: LiveFirms, area: Area | null, windowMinutes: number): LiveStats {
  const modisIndexes = new Set<number>();
  const viirsIndexes = new Set<number>();
  const pairs = raw.links.filter(([mi, vi, dt]) => insideArea(raw.modis[mi][0], raw.modis[mi][1], area) && insideArea(raw.viirs[vi][0], raw.viirs[vi][1], area) && dt <= windowMinutes);
  for (const [mi, vi] of pairs) {
    modisIndexes.add(mi);
    viirsIndexes.add(vi);
  }
  const modisBySatellite = LIVE_MODIS_SATS.map((satellite, satIndex) => {
    const rows = raw.modis.map((row, index) => ({ row, index })).filter(({ row }) => row[5] === satIndex && insideArea(row[0], row[1], area));
    return { satellite, count: rows.length, paired: rows.filter(({ index }) => modisIndexes.has(index)).length };
  });
  const viirsBySatellite = LIVE_VIIRS_SATS.map((satellite, satIndex) => {
    const rows = raw.viirs.map((row, index) => ({ row, index })).filter(({ row }) => row[5] === satIndex && insideArea(row[0], row[1], area));
    return { satellite, count: rows.length, paired: rows.filter(({ index }) => viirsIndexes.has(index)).length };
  });
  const modisRows = raw.modis.map((row, index) => ({ row, index })).filter(({ row }) => insideArea(row[0], row[1], area));
  const viirsRows = raw.viirs.map((row) => row).filter((row) => insideArea(row[0], row[1], area));
  const distances = pairs.map(([mi, vi]) => haversine({ lon: raw.modis[mi][0], lat: raw.modis[mi][1] }, { lon: raw.viirs[vi][0], lat: raw.viirs[vi][1] }));
  return {
    modis: modisRows.length,
    viirs: viirsRows.length,
    pairedModis: modisIndexes.size,
    pairedViirs: viirsIndexes.size,
    pairs: pairs.length,
    modisBySatellite,
    viirsBySatellite,
    medianKm: median(distances),
    medianMinutes: median(pairs.map(([, , minutes]) => minutes)),
  };
}

export interface LiveDetail {
  id: string;
  sensor: "MODIS" | "VIIRS";
  satellite: string;
  lon: number;
  lat: number;
  minutesAfterBase: number;
  frp: number;
  confidence: string;
  partners: LivePartner[];
  clusterStatus: "matched" | "viirs_only" | "modis_only" | null;
  pModisDetect: number | null;
  frpCalibrated: number | null;
  predictionModel: string | null;
}

type LivePartner = { id: string; sensor: "MODIS" | "VIIRS"; minutes: number; km: number | null };

export function liveDetail(raw: LiveFirms, id: string): LiveDetail | null {
  const modis = id.startsWith("M");
  const index = Number(id.slice(1));
  if (!Number.isInteger(index) || index < 0) return null;
  const row: LiveModisRow | LiveViirsRow | undefined = modis ? raw.modis[index] : raw.viirs[index];
  if (!row) return null;
  const partners = raw.links.flatMap<LivePartner>(([mi, vi, minutes]) => {
    if (modis && mi === index) return [{ id: `V${vi}`, sensor: "VIIRS" as const, minutes, km: haversine({ lon: raw.modis[mi][0], lat: raw.modis[mi][1] }, { lon: raw.viirs[vi][0], lat: raw.viirs[vi][1] }) }];
    if (!modis && vi === index) return [{ id: `M${mi}`, sensor: "MODIS" as const, minutes, km: haversine({ lon: raw.modis[mi][0], lat: raw.modis[mi][1] }, { lon: raw.viirs[vi][0], lat: raw.viirs[vi][1] }) }];
    return [];
  });
  const cluster = raw.clusters?.find((entry) => entry.member_ids.includes(id)) ?? null;
  return {
    id,
    sensor: modis ? "MODIS" : "VIIRS",
    satellite: modis ? LIVE_MODIS_SATS[row[5]] ?? "Terra" : LIVE_VIIRS_SATS[row[5]] ?? "S-NPP",
    lon: row[0], lat: row[1], minutesAfterBase: row[2], frp: row[3],
    confidence: modis ? `${row[4]}%` : LIVE_VIIRS_CLASSES[row[4]] ?? "nominal",
    partners,
    clusterStatus: cluster?.match_status ?? null,
    pModisDetect: cluster?.p_modis_detect ?? null,
    frpCalibrated: cluster?.frp_calibrated ?? null,
    predictionModel: cluster?.prediction_model ?? null,
  };
}

export function useLiveGeoJSON(raw: LiveFirms | null): LiveGeoJSON | null {
  return useMemo(() => raw ? liveGeoJSON(raw) : null, [raw]);
}
