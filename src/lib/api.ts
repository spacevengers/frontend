// Backend API client. The Go service exposes native endpoints plus
// /api/integration/* view adapters that match this file's types.

import type { Filters, HarmonizedObservation, Observation, Statistics } from "./types";

const API = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");

function qs(f: Filters) {
  const p = new URLSearchParams({ start: f.start, end: f.end });
  f.sensors.forEach((s) => p.append("sensor", s));
  if (f.bbox) p.set("bbox", f.bbox.join(","));
  return p.toString();
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  if (!API) throw new Error("NEXT_PUBLIC_API_URL is not set (copy .env.example to .env.local)");
  const res = await fetch(`${API}${path}`, { signal });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} on ${path}`);
  return res.json() as Promise<T>;
}

export const getObservations = (f: Filters, signal?: AbortSignal) =>
  get<Observation[]>(`/api/integration/observations?${qs(f)}`, signal);

export const getHarmonized = (f: Filters, signal?: AbortSignal) =>
  get<HarmonizedObservation[]>(`/api/integration/harmonized-observations?${qs(f)}`, signal);

export const getStatistics = (f: Filters, signal?: AbortSignal) =>
  get<Statistics>(`/api/integration/statistics?${qs(f)}`, signal);
