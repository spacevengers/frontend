// API client. Endpoints follow spec §11. With NEXT_PUBLIC_API_URL unset the
// client serves mock data, so the UI works before the backend exists.

import { MOCK } from "./mock-data";
import type {
  Filters,
  HarmonizedObservation,
  MatchStatus,
  Observation,
  Statistics,
} from "./types";

const API = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
export const USING_MOCK = !API;

function qs(f: Filters) {
  const p = new URLSearchParams({ start: f.start, end: f.end });
  f.sensors.forEach((s) => p.append("sensor", s));
  if (f.bbox) p.set("bbox", f.bbox.join(","));
  return p.toString();
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} on ${path}`);
  return res.json() as Promise<T>;
}

const inRange = (iso: string, f: Filters) => {
  const d = iso.slice(0, 10);
  return d >= f.start && d <= f.end;
};

export async function getObservations(f: Filters): Promise<Observation[]> {
  if (API) return get(`/api/observations?${qs(f)}`);
  return MOCK.observations.filter(
    (o) => f.sensors.includes(o.sensor) && inRange(o.acquired_at, f),
  );
}

export async function getHarmonized(f: Filters): Promise<HarmonizedObservation[]> {
  if (API) return get(`/api/harmonized-observations?${qs(f)}`);
  return MOCK.harmonized.filter((h) => inRange(h.acquired_at, f));
}

export async function getStatistics(f: Filters): Promise<Statistics> {
  if (API) return get(`/api/statistics?${qs(f)}`);
  const obs = MOCK.observations.filter((o) => inRange(o.acquired_at, f));
  const har = MOCK.harmonized.filter((h) => inRange(h.acquired_at, f));
  const count = (s: MatchStatus) => har.filter((h) => h.match_status === s).length;
  return {
    counts: {
      MODIS: obs.filter((o) => o.sensor === "MODIS").length,
      VIIRS: obs.filter((o) => o.sensor === "VIIRS").length,
    },
    harmonized: {
      matched: count("matched"),
      viirs_only: count("viirs_only"),
      modis_only: count("modis_only"),
    },
  };
}
