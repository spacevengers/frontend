"use client";

import { useEffect, useState } from "react";
import type { Area } from "@/lib/area";
import type { ArchiveMonthSummary, ArchiveSummary } from "@/lib/history/client";

const API = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");

export type BackendArchiveState = {
  value: ArchiveSummary | null;
  loading: boolean;
  error: string | null;
};

/** Whole-period monthly summaries from the Go backend. */
export function useBackendArchiveSummary(
  enabled: boolean,
  area: Area | null,
  start: string,
  end: string,
): BackendArchiveState {
  const [state, setState] = useState<BackendArchiveState>({ value: null, loading: false, error: null });
  const bbox = area?.bbox?.join(",") ?? null;
  const country = area?.kind === "country" ? area.name : "";

  useEffect(() => {
    if (!enabled || !API || !bbox) return;
    const controller = new AbortController();
    const load = async () => {
      setState((current) => ({ ...current, loading: true, error: null }));
      const query = new URLSearchParams({ start, end, bbox });
      if (country) query.set("country", country);
      try {
        const response = await fetch(`${API}/api/integration/archive/summary?${query}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          const body = await response.json().catch(() => null) as { detail?: string } | null;
          throw new Error(body?.detail ?? `Backend archive failed (${response.status})`);
        }
        const payload = await response.json() as {
          country: string;
          months: Record<string, ArchiveMonthSummary>;
        };
        setState({
          value: { country: payload.country, months: payload.months },
          loading: false,
          error: null,
        });
      } catch (error) {
        if (!controller.signal.aborted) {
          setState({
            value: null,
            loading: false,
            error: error instanceof Error ? error.message : "Could not load backend archive.",
          });
        }
      }
    };
    void load();
    return () => controller.abort();
  }, [enabled, bbox, country, start, end]);

  return state;
}
