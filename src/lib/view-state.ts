"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { parseBbox } from "@/lib/area";
import type { Bbox } from "@/lib/geo/world";
import { DEFAULT_MONTH, fromYearMonth, toYearMonth } from "@/lib/period";

export interface ViewState {
  mi: number;
  bbox: Bbox | null;
  country: string | null;
}

const COUNTRY_NAME = /^[\p{L}][\p{L} .,'()-]{0,59}$/u;

export function parseViewState(params: { get(name: string): string | null }): ViewState {
  const country = params.get("country");
  const validCountry = country && COUNTRY_NAME.test(country) ? country : null;
  return {
    mi: fromYearMonth(params.get("month")) ?? DEFAULT_MONTH,
    bbox: validCountry ? null : parseBbox(params.get("bbox")),
    country: validCountry,
  };
}

export function serializeViewState(state: ViewState): string {
  const params = new URLSearchParams();
  if (state.mi !== DEFAULT_MONTH) params.set("month", toYearMonth(state.mi));
  if (state.country) params.set("country", state.country);
  else if (state.bbox) params.set("bbox", state.bbox.join(","));
  return params.toString();
}

export type ViewPatch = Partial<ViewState>;

export function useViewState() {
  const searchParams = useSearchParams();
  const view = useMemo(() => parseViewState(searchParams), [searchParams]);

  const update = useCallback((patch: ViewPatch) => {
    const next = { ...parseViewState(new URLSearchParams(window.location.search)), ...patch };
    if (patch.country) next.bbox = null;
    else if (patch.bbox) next.country = null;
    const query = serializeViewState(next);
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  }, []);

  return [view, update] as const;
}
