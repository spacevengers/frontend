// API client. Endpoints follow spec §11; names and params are still to be
// agreed with the backend. Requires NEXT_PUBLIC_API_URL (see .env.example).

import type { Filters, HarmonizedObservation, Observation, Statistics } from "./types";

const API = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");

function qs(f: Filters) {
  const p = new URLSearchParams({ start: f.start, end: f.end });
  f.sensors.forEach((s) => p.append("sensor", s));
  if (f.bbox) p.set("bbox", f.bbox.join(","));
  return p.toString();
}

async function get<T>(path: string): Promise<T> {
  if (!API) throw new Error("NEXT_PUBLIC_API_URL is not set (copy .env.example to .env.local)");
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} on ${path}`);
  return res.json() as Promise<T>;
}

export const getObservations = (f: Filters) =>
  get<Observation[]>(`/api/observations?${qs(f)}`);

export const getHarmonized = (f: Filters) =>
  get<HarmonizedObservation[]>(`/api/harmonized-observations?${qs(f)}`);

export const getStatistics = (f: Filters) =>
  get<Statistics>(`/api/statistics?${qs(f)}`);
