"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AreaChart } from "@/components/charts/charts";
import { GlobeView } from "@/components/globe/GlobeView";
import { LoadState, Panel, Provenance, SplitBars } from "@/components/Panel";
import { areaLabel } from "@/lib/area";
import { fmt } from "@/lib/format";
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
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      const current = parseViewState(new URLSearchParams(window.location.search)).mi;
      setView({ mi: (current + 1) % MONTH_COUNT });
    }, 900);
    return () => clearInterval(timer);
  }, [playing, setView]);

  const stats = useMemo(() => (ds ? statsFor(ds, mi, area) : null), [ds, mi, area]);
  const lastYear = useMemo(() => (ds && mi >= 12 ? statsFor(ds, mi - 12, area) : null), [ds, mi, area]);
  const totals = useMemo(() => (ds ? Array.from({ length: MONTH_COUNT }, (_, m) => statsFor(ds, m, area).harmonized) : []), [ds, area]);
  const year = Math.floor(mi / 12);
  const yearStats = useMemo(() => (ds ? Array.from({ length: 12 }, (_, k) => statsFor(ds, year * 12 + k, area)) : []), [ds, year, area]);
  const points = useMemo(() => (ds ? densityPoints(ds, mi) : []), [ds, mi]);
  const callout = useMemo(() => (ds && stats ? busiestRegion(ds, mi, area, stats) : null), [ds, mi, area, stats]);

  const totalMax = Math.max(1, ...totals);
  const ranking = stats ? Object.entries(stats.byCountry).sort((a, b) => b[1] - a[1]).slice(0, 7) : [];
  const rankMax = ranking[0]?.[1] ?? 1;
  const suffix = query ? `?${query}` : "";

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

      <div className="overlay">
        <aside className="side" aria-label="Summary">
          <Panel title="Overview" aside={monthLabel(mi)}>
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
              <div>
                <div className="kpi-big num">{stats ? fmt(stats.harmonized) : "–"}</div>
                <div className="kpi-label">
                  harmonized records {stats ? <Change now={stats.harmonized} before={lastYear?.harmonized} versus={mi >= 12 ? monthShort(mi - 12) : undefined} /> : null}
                </div>
              </div>
              <div className="kpi-row border-t border-line pt-3">
                <div className="kpi">
                  <div className="v num">{stats ? fmt(stats.modis) : "–"}</div>
                  <div className="l"><i className="sw sq" />MODIS</div>
                  <span>{stats ? <Change now={stats.modis} before={lastYear?.modis} /> : null}</span>
                </div>
                <div className="kpi">
                  <div className="v num">{stats ? fmt(stats.viirs) : "–"}</div>
                  <div className="l"><i className="sw ci" />VIIRS</div>
                  <span>{stats ? <Change now={stats.viirs} before={lastYear?.viirs} /> : null}</span>
                </div>
                <div className="kpi">
                  <div className="v num">{stats ? fmt(stats.pairs) : "–"}</div>
                  <div className="l"><i className="sw ln" />pairs</div>
                  <span className="muted text-[10.5px]">potentially corresponding</span>
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Harmonized records by country">
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
          </Panel>
        </aside>

        <aside className="side right" aria-label="Trends and provenance">
          <Panel title={`Monthly records, ${yearOf(mi)}`}>
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
          </Panel>

          <Panel title="Seen by both sensors, or one">
            {stats ? (
              <SplitBars
                rows={[
                  { label: "MODIS (Aqua) with a VIIRS partner", value: stats.aquaPaired, color: "var(--magma-5)" },
                  { label: `MODIS only (Terra, or Aqua outside ±${MATCHING_RULE.maxMinutes} min)`, value: stats.modisOnly, color: "var(--cool)" },
                  { label: "VIIRS only", value: stats.viirsOnly, color: "var(--hot)" },
                ]}
              />
            ) : null}
            <p className="muted mt-2.5 mb-0 text-[11px]">A detection seen by one sensor only is not an error.</p>
          </Panel>

          <Panel title="Data and provenance">
            <Provenance
              rows={[
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
        <div className="timeline glass">
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
        </div>
      </div>
    </main>
  );
}
