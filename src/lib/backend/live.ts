"use client";

import { useEffect, useState } from "react";
import type { LiveFirms } from "@/lib/firms/types";
import type { Filters } from "@/lib/types";

const API = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");

export const BACKEND_CONFIGURED = Boolean(API);

type LoadState = {
  data: LiveFirms | null;
  error: string | null;
  loading: boolean;
  retry: () => void;
};

function params(filters: Filters) {
  const p = new URLSearchParams({ start: filters.start, end: filters.end });
  filters.sensors.forEach((sensor) => p.append("sensor", sensor));
  if (filters.bbox) p.set("bbox", filters.bbox.join(","));
  return p.toString();
}

/** Load a backend month/area as the compact shape the map already renders. */
export function useBackendFirms(enabled: boolean, filters: Filters | null): LoadState {
  const [state, setState] = useState<Omit<LoadState, "retry">>(() => ({
    data: null,
    error: API ? null : "NEXT_PUBLIC_API_URL is not set",
    loading: false,
  }));
  const [attempt, setAttempt] = useState(0);
  const key = filters ? params(filters) : null;

  useEffect(() => {
    if (!enabled || !key || !API) return;
    const controller = new AbortController();
    const load = async () => {
      setState((current) => ({ ...current, loading: true, error: null }));
      const url = `${API}/api/integration/firms?${key}`;
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
          const body = await response.json().catch(() => null) as { detail?: string } | null;
          throw new Error(body?.detail ?? `Backend request failed (${response.status})`);
        }
        const data = await response.json() as LiveFirms;
        setState({ data, error: null, loading: false });
      } catch (error) {
        if (!controller.signal.aborted) {
          setState({
            data: null,
            error: error instanceof Error ? error.message : "Could not load backend data.",
            loading: false,
          });
        }
      }
    };
    void load();
    return () => controller.abort();
  }, [enabled, key, attempt]);

  return { ...state, retry: () => setAttempt((current) => current + 1) };
}
