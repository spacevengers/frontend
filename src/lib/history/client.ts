"use client";

import { useEffect, useState } from "react";
import type { Comparison, MonthStats } from "@/lib/sample/stats";
import type { LiveFirms, LiveModisRow, LiveViirsRow } from "@/lib/firms/types";
import { toYearMonth } from "@/lib/period";

export interface ArchiveMonthSummary extends Pick<MonthStats, "harmonized" | "modis" | "viirs" | "pairs"> {
  modisBySatellite: { Terra: number; Aqua: number };
  viirsBySatellite: { "S-NPP": number; "NOAA-20": number };
  aquaPaired: number;
  terraPaired: number;
  viirsPaired: number;
  medianPairKm: number | null;
  medianPairMinutes: number | null;
  distanceBins: number[];
  timeBins: number[];
  modisConfidenceBins: number[];
  viirsConfidence: Comparison["viirsConfidence"];
  frp: [number, number][];
}

export interface ArchiveSummary {
  country: string;
  months: Record<string, ArchiveMonthSummary>;
}

const ARCHIVE_COUNTRIES = new Set(["Kenya"]);

export function hasCountryArchive(country: string | null | undefined): boolean {
  return Boolean(country && ARCHIVE_COUNTRIES.has(country));
}

export type ArchiveMonth = Pick<LiveFirms, "baseTime" | "modis" | "viirs" | "links"> & { country: string; month: string };

function useJson<T>(url: string | null) {
  const [state, setState] = useState<{ key: string | null; value: T | null }>({ key: null, value: null });
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    fetch(url, { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error("Archive unavailable");
      return response.json() as Promise<T>;
    }).then((value) => setState({ key: url, value })).catch(() => {
      if (!controller.signal.aborted) setState({ key: url, value: null });
    });
    return () => controller.abort();
  }, [url]);
  return { value: state.key === url ? state.value : null, loading: Boolean(url) && state.key !== url };
}

export function useArchiveSummary(country: string | null) {
  const countryPath = country && hasCountryArchive(country) ? encodeURIComponent(country) : null;
  return useJson<ArchiveSummary>(countryPath ? `/history/${countryPath}/summary.json` : null);
}

export function useArchiveMonth(country: string | null, mi: number) {
  const countryPath = country && hasCountryArchive(country) ? encodeURIComponent(country) : null;
  const month = toYearMonth(mi);
  return useJson<ArchiveMonth>(countryPath ? `/history/${countryPath}/${month}.json` : null);
}

export function archiveMonthStats(summary: ArchiveMonthSummary): MonthStats {
  return {
    harmonized: summary.harmonized,
    modis: summary.modis,
    viirs: summary.viirs,
    pairs: summary.pairs,
    modisOnly: summary.modis - summary.aquaPaired - summary.terraPaired,
    viirsOnly: summary.viirs - summary.viirsPaired,
    aqua: summary.modisBySatellite.Aqua,
    aquaPaired: summary.aquaPaired,
    terra: summary.modisBySatellite.Terra,
    terraPaired: summary.terraPaired,
    viirsPaired: summary.viirsPaired,
    byCountry: { Kenya: summary.harmonized },
    byRegion: {},
  };
}

export function archiveComparison(summary: ArchiveMonthSummary): Comparison {
  return {
    pairs: summary.pairs,
    distanceBins: summary.distanceBins,
    medianKm: summary.medianPairKm ?? 0,
    timeBins: summary.timeBins,
    medianMinutes: summary.medianPairMinutes ?? 0,
    frp: summary.frp,
    modisConfidenceBins: summary.modisConfidenceBins,
    viirsConfidence: summary.viirsConfidence,
  };
}

export function archiveLiveShape(month: ArchiveMonth): LiveFirms {
  return {
    generatedAt: "",
    baseTime: month.baseTime,
    rule: { maxKm: 1.5, maxMinutes: 30, widestMinutes: 30 },
    sources: [],
    modis: month.modis as LiveModisRow[],
    viirs: month.viirs as LiveViirsRow[],
    links: month.links,
  };
}
