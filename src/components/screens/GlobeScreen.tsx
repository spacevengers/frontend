"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AreaChart } from "@/components/charts/charts";
import { GlobeView } from "@/components/globe/GlobeView";
import { LoadState, Panel, Provenance, SplitBars } from "@/components/Panel";
import { areaLabel } from "@/lib/area";
import { fmt } from "@/lib/format";
import { isLiveSourceStale, liveStats, useLiveFirms } from "@/lib/firms/live";
import { FIRST_YEAR, LAST_YEAR, MONTH_COUNT, monthLabel, monthShort, YEARS, yearOf } from "@/lib/period";
import { MATCHING_RULE } from "@/lib/sample/dataset";
import { busiestRegion, densityPoints, statsFor } from "@/lib/sample/stats";
import { useDataset } from "@/lib/sample/use-dataset";
import { useTheme } from "@/lib/theme";
import { useArea } from "@/lib/use-area";
import { parseViewState, useViewState } from "@/lib/view-state";

function Change({ now, before, versus }: { now: number; before: number | undefined; versus?: string }) {
  if (!before) return null;
  const d = Math.round(((now - before) / before) * 100);
  return (
    <span className={`badge ${d >= 0 ? "up" : "down"}`} title={versus ? `Change vs ${versus}` : undefined}>
      {d >= 0 ? "↑" : "↓"} {Math.abs(d)}%{versus ? ` vs ${versus}` : ""}
    </span>
  );
}

export function GlobeScreen() {
  const [view, setView] = useViewState();
  const query = useSearchParams().toString();
  const { ds, status, error } = useDataset();
  const theme = useTheme();
  const area = useArea(ds?.world ?? null, view);
  const { mi } = view;
  const [dataMode, setDataMode] = useState<"sample" | "live">("live");
  const [playing, setPlaying] = useState(false);
  const liveState = useLiveFirms(true);
  const liveSummary = useMemo(() => liveState.data ? liveStats(liveState.data, area, 30) : null, [liveState.data, area]);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      const current = parseViewState(new URLSearchParams(window.location.search)).mi;
      setView({ mi: (current + 1) % MONTH_COUNT });
    }, 900);
    return () => clearInterval(timer);
  }, [playing, setView]);

  const stats = useMemo(() => (dataMode === "sample" && ds ? statsFor(ds, mi, area) : null), [dataMode, ds, mi, area]);
  const lastYear = useMemo(() => (dataMode === "sample" && ds && mi >= 12 ? statsFor(ds, mi - 12, area) : null), [dataMode, ds, mi, area]);
  const totals = useMemo(() => (dataMode === "sample" && ds ? Array.from({ length: MONTH_COUNT }, (_, m) => statsFor(ds, m, area).harmonized) : []), [dataMode, ds, area]);
  const year = Math.floor(mi / 12);
  const yearStats = useMemo(() => (dataMode === "sample" && ds ? Array.from({ length: 12 }, (_, k) => statsFor(ds, year * 12 + k, area)) : []), [dataMode, ds, year, area]);
  const points = useMemo(() => {
    if (dataMode === "live") {
      if (!liveState.data) return [];
      return [
        ...liveState.data.modis.map((row) => ({ lat: row[1], lng: row[0], w: 1 })),
        ...liveState.data.viirs.map((row) => ({ lat: row[1], lng: row[0], w: 1 })),
      ];
    }
    return ds ? densityPoints(ds, mi) : [];
  }, [dataMode, liveState.data, ds, mi]);
  const callout = useMemo(() => (dataMode === "sample" && ds && stats ? busiestRegion(ds, mi, area, stats) : null), [dataMode, ds, mi, area, stats]);

  const totalMax = Math.max(1, ...totals);
  const ranking = stats ? Object.entries(stats.byCountry).sort((a, b) => b[1] - a[1]).slice(0, 7) : [];
  const rankMax = ranking[0]?.[1] ?? 1;
  const suffix = query ? `?${query}` : "";
  const incompleteSources = liveState.data?.sources.filter((source) => !source.ok || source.rows === 0 || isLiveSourceStale(source.updated)) ?? [];

  return (
    <main className="stage" aria-label="Globe overview">
      {ds ? (
        <GlobeView
          ds={ds}
          points={points}
          area={area}
          theme={theme}
          callout={callout}
          label="Globe of detection density. Drag to rotate, scroll to zoom, click a country to select it."
          onPickCountry={(name) => setView(name ? { country: name } : { country: null, bbox: null })}
        />
      ) : (
        <div className="map-status">
          <LoadState status={status === "error" ? "error" : "loading"} error={error} />
        </div>
      )}
      <div className="fade-l" />
      <div className="fade-r" />
      <div className="fade-b" />

      <div className="filterbar filters" role="toolbar" aria-label="Globe data source">
        <div className="seg" role="group" aria-label="Data source">
          <button type="button" aria-pressed={dataMode === "sample"} onClick={() => { setPlaying(false); setDataMode("sample"); }}>Sample history</button>
          <button type="button" aria-pressed={dataMode === "live"} onClick={() => { setPlaying(false); setDataMode("live"); }}>Live · last 24 h</button>
        </div>
      </div>

      <div className="overlay">
        <aside className="side" aria-label="Summary">
          <Panel title="Overview" aside={dataMode === "live" ? "Live · last 24 h" : monthLabel(mi)}>
            <div className="flex flex-col gap-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="chip">Area · {areaLabel(area)}</span>
                {area ? (
                  <button className="muted cursor-pointer text-xs underline" type="button" onClick={() => setView({ country: null, bbox: null })}>
                    Whole world
                  </button>
                ) : (
                  <Link className="muted text-xs underline" href={`/map${suffix}`}>Filter and inspect records on the map</Link>
                )}
              </div>
              {dataMode === "live" ? <>
                <div>
                  <div className="kpi-big num">{liveSummary ? fmt(liveSummary.modis + liveSummary.viirs) : "–"}</div>
                  <div className="kpi-label">live detections</div>
                </div>
                <div className="kpi-row border-t border-line pt-3">
                  <div className="kpi"><div className="v num">{liveSummary ? fmt(liveSummary.modis) : "–"}</div><div className="l"><i className="sw sq" />MODIS</div></div>
                  <div className="kpi"><div className="v num">{liveSummary ? fmt(liveSummary.viirs) : "–"}</div><div className="l"><i className="sw ci" />VIIRS</div></div>
                  <div className="kpi"><div className="v num">{liveSummary ? fmt(liveSummary.pairs) : "–"}</div><div className="l"><i className="sw ln" />pairs</div></div>
                </div>
                <p className="note">Latest detections, last 24 h, refreshed every 30 min while this page is open.</p>
                {liveState.loading ? <p className="note" role="status">{liveState.data ? "Refreshing NASA FIRMS…" : "Fetching NASA FIRMS…"}</p> : null}
                {liveState.error ? <p className="note" role="alert">{liveState.error} <button className="btn sm" type="button" onClick={liveState.retry}>Retry</button></p> : null}
                {incompleteSources.length ? <p className="note" role="status">{incompleteSources.length} source file{incompleteSources.length === 1 ? " is" : "s are"} empty, unavailable, or older than 24 hours; counts may be incomplete.</p> : null}
                {liveState.data ? <p className="note">Snapshot generated {new Date(liveState.data.generatedAt).toLocaleString()}.</p> : null}
              </> : <>
                <div>
                  <div className="kpi-big num">{stats ? fmt(stats.harmonized) : "–"}</div>
                  <div className="kpi-label">
                    sample harmonized records {stats ? <Change now={stats.harmonized} before={lastYear?.harmonized} versus={mi >= 12 ? monthShort(mi - 12) : undefined} /> : null}
                  </div>
                </div>
                <div className="kpi-row border-t border-line pt-3">
                  <div className="kpi"><div className="v num">{stats ? fmt(stats.modis) : "–"}</div><div className="l"><i className="sw sq" />MODIS</div><span>{stats ? <Change now={stats.modis} before={lastYear?.modis} /> : null}</span></div>
                  <div className="kpi"><div className="v num">{stats ? fmt(stats.viirs) : "–"}</div><div className="l"><i className="sw ci" />VIIRS</div><span>{stats ? <Change now={stats.viirs} before={lastYear?.viirs} /> : null}</span></div>
                  <div className="kpi"><div className="v num">{stats ? fmt(stats.pairs) : "–"}</div><div className="l"><i className="sw ln" />pairs</div><span className="muted text-[10.5px]">potentially corresponding</span></div>
                </div>
              </>}
            </div>
          </Panel>

          {dataMode === "sample" ? <Panel title="Harmonized records by country">
            {ranking.length ? (
              <div className="rank">
                {ranking.map(([country, n], i) => (
                  <div key={country} className="contents">
                    <span className="i num">{String(i + 1).padStart(2, "0")}</span>
                    <span className="n">
                      <button type="button" onClick={() => setView({ country })} title={`Select ${country}`}>{country}</button>
                      <span className="bar"><i style={{ width: `${(n / rankMax) * 100}%` }} /></span>
                    </span>
                    <span className="c num">{fmt(n)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted m-0">{ds ? "No detections in this area and period." : "Loading records…"}</p>
            )}
          </Panel> : <Panel title="NASA FIRMS sources">
            {liveState.data ? liveState.data.sources.map((source) => {
              return <p className="note" key={source.name}>{source.name}: {source.ok ? `${fmt(source.rows)} rows${source.rows === 0 ? " · empty" : ""}${source.updated ? ` · ${source.updated}` : ""}${isLiveSourceStale(source.updated) ? " · stale" : ""}` : "unavailable"}</p>;
            }) : <p className="muted m-0">{liveState.loading ? "Loading source status…" : "No source data loaded."}</p>}
          </Panel>}
        </aside>

        <aside className="side right" aria-label="Trends and provenance">
          {dataMode === "sample" ? <Panel title={`Monthly records, ${yearOf(mi)}`}>
            {yearStats.length ? (
              <AreaChart
                highlight={mi % 12}
                series={[
                  { name: "VIIRS", color: "var(--hot)", values: yearStats.map((s) => s.viirs) },
                  { name: "Harmonized", color: "var(--magma-5)", values: yearStats.map((s) => s.harmonized) },
                  { name: "MODIS", color: "var(--cool)", values: yearStats.map((s) => s.modis) },
                ]}
              />
            ) : null}
            <div className="markers mt-1.5">
              <span><i className="sw" style={{ background: "var(--hot)" }} />VIIRS</span>
              <span><i className="sw" style={{ background: "var(--magma-5)" }} />Harmonized</span>
              <span><i className="sw" style={{ background: "var(--cool)" }} />MODIS</span>
            </div>
          </Panel> : <Panel title="Live detections by satellite">
            {liveSummary ? <>
              {liveSummary.modisBySatellite.map((row) => <p className="note" key={row.satellite}>MODIS · {row.satellite}: {fmt(row.count)} detections, {fmt(row.paired)} paired</p>)}
              {liveSummary.viirsBySatellite.map((row) => <p className="note" key={row.satellite}>VIIRS · {row.satellite}: {fmt(row.count)} detections, {fmt(row.paired)} paired</p>)}
            </> : <p className="muted m-0">{liveState.loading ? "Loading live detections…" : "No live data loaded."}</p>}
          </Panel>}

          <Panel title="Seen by both sensors, or one">
            {dataMode === "live" && liveSummary ? <SplitBars rows={[
              { label: "Matched detections", value: liveSummary.pairedModis + liveSummary.pairedViirs, color: "var(--magma-5)" },
              { label: "MODIS only", value: liveSummary.modis - liveSummary.pairedModis, color: "var(--cool)" },
              { label: "VIIRS only", value: liveSummary.viirs - liveSummary.pairedViirs, color: "var(--hot)" },
            ]} /> : dataMode === "sample" && stats ? (
              <SplitBars
                rows={[
                  { label: "MODIS (Aqua) with a VIIRS partner", value: stats.aquaPaired, color: "var(--magma-5)" },
                  { label: `MODIS only (Terra, or Aqua outside ±${MATCHING_RULE.maxMinutes} min)`, value: stats.modisOnly, color: "var(--cool)" },
                  { label: "VIIRS only", value: stats.viirsOnly, color: "var(--hot)" },
                ]}
              />
            ) : null}
            <p className="muted mt-2.5 mb-0 text-[11px]">{dataMode === "live" && liveSummary ? `${fmt(liveSummary.pairs)} potential pair links within 1.5 km and 30 minutes.` : "A detection seen by one sensor only is not an error."}</p>
          </Panel>

          <Panel title="Data and provenance">
            <Provenance
              rows={dataMode === "live" ? [
                ["Source", "NASA FIRMS, public global CSVs"],
                ["Coverage", "Latest 24 hours"],
                ["Generated", liveState.data ? new Date(liveState.data.generatedAt).toLocaleString() : "Loading"],
                ["Refresh", "Every 30 minutes while this page is open"],
                ["Pairing", "≤ 1.5 km and ≤ 30 min"],
              ] : [
                ["MODIS product", "MCD14ML, C6.1 (placeholder)"],
                ["VIIRS product", "VNP14IMG, 375 m (placeholder)"],
                ["Coverage", "Global"],
                ["Period on record", `Jan ${FIRST_YEAR} – Dec ${LAST_YEAR}`],
                ["Matching rule", `≤ ${MATCHING_RULE.maxKm} km and ± ${MATCHING_RULE.maxMinutes} min`],
              ]}
            />
          </Panel>
        </aside>
      </div>

      <div className="center-bottom">
        <div className="legend glass w-full max-w-[360px]">
          <div className="title">Detection density</div>
          <div className="ramp" />
          <div className="ends"><span>Fewer detections</span><span>More detections</span></div>
        </div>
        {dataMode === "sample" ? <div className="timeline glass">
          <div className="tl-row">
            <button className="btn sm" type="button" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play through months"} aria-pressed={playing}>
              {playing ? "❚❚" : "▶"}
            </button>
            <div className="relative flex-1">
              <div className="bar">
                {totals.map((v, m) => (
                  <span key={m} className={Math.floor(m / 12) === year ? "on" : undefined} style={{ height: `${Math.max(6, (v / totalMax) * 100)}%` }} />
                ))}
              </div>
              <div className="handle" style={{ left: `calc(${(mi / (MONTH_COUNT - 1)) * 100}% - 1px)` }}>
                <em>{monthShort(mi).toUpperCase()}</em>
              </div>
              <input type="range" min={0} max={MONTH_COUNT - 1} value={mi} aria-label="Month" aria-valuetext={monthLabel(mi)} onChange={(e) => setView({ mi: Number(e.target.value) })} />
            </div>
          </div>
          <div className="years">
            {Array.from({ length: YEARS }, (_, y) => <span key={y}>{FIRST_YEAR + y}</span>)}
          </div>
        </div> : null}
      </div>
    </main>
  );
}
