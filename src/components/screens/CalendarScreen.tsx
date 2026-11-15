"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { FrpScatter, Histogram } from "@/components/charts/charts";
import { LoadState, Panel, Provenance, SplitBars } from "@/components/Panel";
import { areaLabel, resolveArea } from "@/lib/area";
import { luminance, ramp } from "@/lib/color";
import { exportMonth } from "@/lib/export";
import { capitalize, fmt } from "@/lib/format";
import { FIRST_YEAR, LAST_YEAR, MONTH_COUNT, monthLabel, MONTHS, MONTHS_LONG, YEARS } from "@/lib/period";
import { MATCHING_RULE, type ViirsClass } from "@/lib/sample/dataset";
import { comparisonFor, median, type MonthStats, statsFor } from "@/lib/sample/stats";
import { useDataset } from "@/lib/sample/use-dataset";
import { useTheme } from "@/lib/theme";
import { useArea } from "@/lib/use-area";
import { useViewState } from "@/lib/view-state";

type RecordSet = "harmonized" | "modis" | "viirs";
type Scale = "count" | "anomaly";

const SETS: { value: RecordSet; label: string; noun: string }[] = [
  { value: "harmonized", label: "Harmonized", noun: "harmonized records" },
  { value: "modis", label: "MODIS", noun: "MODIS detections" },
  { value: "viirs", label: "VIIRS", noun: "VIIRS detections" },
];

const RAMPS = {
  dark: {
    count: ["#10151B", "#4A1265", "#8E1F6E", "#D2344F", "#F5702A", "#FFB833", "#FFF1B8"],
    anomaly: ["#9AD9FF", "#3F8FCC", "#1F4A6E", "#141A21", "#7A4318", "#D97A26", "#FFC56B"],
  },
  light: {
    count: ["#E3ECF5", "#FCE3C8", "#F9C08A", "#F2924A", "#E0621D", "#B43E0E", "#6E1F05"],
    anomaly: ["#0B4A9E", "#3F8FE0", "#A9CDF2", "#E3ECF5", "#F6C79A", "#E8742A", "#9E3A08"],
  },
};

const ordinal = (n: number) => {
  const rule = n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0;
  return `${n}${["th", "st", "nd", "rd"][rule]}`;
};
const percent = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : "–");

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function CalendarScreen() {
  const [view, setView] = useViewState();
  const query = useSearchParams().toString();
  const { ds, status, error } = useDataset();
  const theme = useTheme();
  const area = useArea(ds?.world ?? null, view);
  const { mi } = view;
  const [set, setSet] = useState<RecordSet>("harmonized");
  const [scale, setScale] = useState<Scale>("count");
  const [tip, setTip] = useState<{ m: number; x: number; y: number } | null>(null);

  const months = useMemo<MonthStats[]>(() => (ds ? Array.from({ length: MONTH_COUNT }, (_, m) => statsFor(ds, m, area)) : []), [ds, area]);
  const comparison = useMemo(() => (ds ? comparisonFor(ds, mi, area) : null), [ds, mi, area]);

  if (!ds || !comparison) {
    return (
      <main className="cal-wrap">
        <LoadState status={status === "error" ? "error" : "loading"} error={error} />
      </main>
    );
  }

  const values = months.map((s) => s[set]);
  const monthMedian = (month: number) => median(Array.from({ length: YEARS }, (_, y) => values[y * 12 + month]));

  const everything = SETS.flatMap((s) => months.map((m) => m[s.value])).filter((v) => v > 0);
  const lo = Math.log10(Math.min(...everything, Number.POSITIVE_INFINITY));
  const hi = Math.log10(Math.max(...everything, 1));
  const stops = RAMPS[theme][scale];
  const position = (m: number) => {
    const v = values[m];
    if (scale === "count") return v > 0 && hi > lo ? (Math.log10(v) - lo) / (hi - lo) : 0;
    const med = monthMedian(m % 12) || 1;
    return 0.5 + Math.max(-1, Math.min(1, (v - med) / med)) / 2;
  };

  const maxM = values.indexOf(Math.max(...values));
  const minM = values.indexOf(Math.min(...values));
  const yearTotals = Array.from({ length: YEARS }, (_, y) => values.slice(y * 12, y * 12 + 12).reduce((a, b) => a + b, 0));
  const yearMax = Math.max(1, ...yearTotals);

  const month = mi % 12;
  const value = values[mi];
  const med = monthMedian(month);
  const rank = Array.from({ length: YEARS }, (_, y) => values[y * 12 + month]).sort((a, b) => b - a).indexOf(value) + 1;
  const noun = SETS.find((s) => s.value === set)?.noun ?? "";
  const stats = months[mi];
  const hasData = everything.length > 0;

  const annotation = (m: number, text: string, color: string, shift: boolean) => (
    <>
      <span className="leader" style={{ gridColumn: (m % 12) + 2, gridRow: `${Math.floor(m / 12) + 2} / ${YEARS + 2}`, background: color }} />
      <span className="annot" style={{ gridColumn: (m % 12) + 2, gridRow: YEARS + 2, color, paddingTop: shift ? 20 : undefined }}>{text}</span>
    </>
  );

  return (
    <main className="cal-wrap">
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center gap-2.5">
          <span className="chip">Area · {areaLabel(area)} · {monthLabel(mi)}</span>
          <Link className="muted text-xs" href={`/map${query ? `?${query}` : ""}`}>Change area on the map</Link>
          {area ? (
            <button className="muted cursor-pointer text-xs underline" type="button" onClick={() => setView({ country: null, bbox: null })}>Whole world</button>
          ) : null}
        </div>
        <p className="headline" aria-live="polite">
          {hasData ? (
            <>
              <b>{fmt(value)}</b> {noun} in {monthLabel(mi)}, <b>{med ? (value / med).toFixed(1) : "0.0"}×</b> the {MONTHS_LONG[month]} median and the{" "}
              <b>{rank === 1 ? "highest" : `${ordinal(rank)} highest`}</b> {MONTHS_LONG[month]} of the {YEARS} years on record.
            </>
          ) : (
            <>No detections in this area during the period on record.</>
          )}
        </p>

        <div className="stack">
          <Panel title={`Monthly counts, ${FIRST_YEAR}–${LAST_YEAR}`}>
            <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2.5">
                <Segmented label="Record set" value={set} options={SETS} onChange={setSet} />
                <Segmented label="Scale" value={scale} onChange={setScale} options={[{ value: "count", label: "Counts" }, { value: "anomaly", label: "Anomaly vs monthly median" }]} />
              </div>
              <div className="cal-legend">
                <span>{scale === "count" ? fmt(10 ** lo || 0) : "−100%"}</span>
                <span className="ramp" style={{ background: `linear-gradient(90deg, ${stops.join(",")})` }} />
                <span>{scale === "count" ? fmt(10 ** hi) : "+100%"}</span>
              </div>
            </div>

            <div className="cal" role="group" aria-label="Monthly counts by year. Select a month to compare.">
              {MONTHS.map((m, i) => <span key={m} className="h" style={{ gridColumn: i + 2, gridRow: 1 }}>{m}</span>)}
              <span className="h text-right" style={{ gridColumn: 14, gridRow: 1 }}>Year total</span>
              {Array.from({ length: YEARS }, (_, y) => (
                <span key={`y${y}`} className="y num" style={{ gridColumn: 1, gridRow: y + 2 }}>{FIRST_YEAR + y}</span>
              ))}
              {values.map((v, m) => {
                const color = ramp(stops, position(m));
                return (
                  <button
                    key={m}
                    type="button"
                    className={`cell${m === mi ? " sel" : ""}`}
                    style={{ gridColumn: (m % 12) + 2, gridRow: Math.floor(m / 12) + 2, background: `rgb(${color.join(",")})` }}
                    aria-label={`${monthLabel(m)}: ${fmt(v)} ${noun}`}
                    aria-pressed={m === mi}
                    onClick={() => setView({ mi: m })}
                    onMouseEnter={(e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      setTip({ m, x: r.left, y: r.top - 34 });
                    }}
                    onMouseLeave={() => setTip(null)}
                  >
                    {hasData && (m === maxM || m === minM) ? <span className="mark" style={{ borderColor: luminance(color) > 0.55 ? "#000" : "#fff" }} /> : null}
                  </button>
                );
              })}
              {yearTotals.map((total, y) => (
                <span key={`t${y}`} className="t num" style={{ gridColumn: 14, gridRow: y + 2 }}>
                  <i style={{ width: (total / yearMax) * 36 }} />
                  {fmt(total)}
                </span>
              ))}
              {hasData ? annotation(maxM, `▲ ${fmt(values[maxM])} · ${MONTHS[maxM % 12]} ${FIRST_YEAR + Math.floor(maxM / 12)}`, "var(--hot-text)", false) : null}
              {hasData && minM !== maxM ? annotation(minM, `▼ ${fmt(values[minM])} · ${MONTHS[minM % 12]} ${FIRST_YEAR + Math.floor(minM / 12)}`, "var(--cool)", minM % 12 === maxM % 12) : null}
            </div>
            <p className="muted mt-4 mb-0 text-[11.5px]">
              All three record sets share one colour scale, so switching between them shows how far the sensors differ. Ringed cells mark the
              highest and lowest month on record for this set.
            </p>
          </Panel>

          <Panel title={`Cross-sensor comparison, ${monthLabel(mi)}`} aside={`${fmt(comparison.pairs)} potentially corresponding pairs`}>
            <div className="charts">
              <figure>
                <figcaption>Distance apart</figcaption>
                <Histogram
                  bins={comparison.distanceBins}
                  label="Distance between paired MODIS and VIIRS detections"
                  ticks={[[0, "0 km"], [0.5, `${MATCHING_RULE.maxKm / 2} km`], [1, `${MATCHING_RULE.maxKm} km`]]}
                  median={{ at: comparison.medianKm / MATCHING_RULE.maxKm, text: `Median ${comparison.medianKm.toFixed(2)} km` }}
                />
              </figure>
              <figure>
                <figcaption>Acquisition-time difference</figcaption>
                <Histogram
                  bins={comparison.timeBins}
                  label="Time between paired MODIS and VIIRS detections"
                  color="var(--magma-5)"
                  ticks={[[0, "0 min"], [0.5, `${MATCHING_RULE.maxMinutes / 2}`], [1, `${MATCHING_RULE.maxMinutes} min`]]}
                  median={{ at: comparison.medianMinutes / MATCHING_RULE.maxMinutes, text: `Median ${Math.round(comparison.medianMinutes)} min` }}
                />
              </figure>
              <figure>
                <figcaption>FRP, MODIS against VIIRS <span className="muted">original values, not calibrated</span></figcaption>
                <FrpScatter points={comparison.frp} />
              </figure>
              <figure>
                <figcaption>Confidence, each on its own scale</figcaption>
                <div className="muted text-[10.5px]">MODIS, percent</div>
                <Histogram bins={comparison.modisConfidenceBins} label="MODIS confidence, percent" height={70} color="var(--cool)" ticks={[[0, "0%"], [1, "100%"]]} />
                <div className="muted mt-1.5 text-[10.5px]">VIIRS, class</div>
                <div className="grid grid-cols-[56px_1fr_auto] items-center gap-x-2 gap-y-1 text-[11px]">
                  {(["low", "nominal", "high"] as ViirsClass[]).map((k) => (
                    <div key={k} className="contents">
                      <span>{capitalize(k)}</span>
                      <i className="block h-2 rounded-sm" style={{ background: "var(--hot)", width: `${(comparison.viirsConfidence[k] / Math.max(1, ...Object.values(comparison.viirsConfidence))) * 100}%` }} />
                      <span className="num">{fmt(comparison.viirsConfidence[k])}</span>
                    </div>
                  ))}
                </div>
              </figure>
            </div>
          </Panel>
        </div>
      </div>

      <aside className="stack">
        <Panel title="Internal consistency">
          <p className="muted mt-0 mb-3 text-xs">
            How well the two sensors agree with each other. This is <b className="text-fg">not accuracy</b> against ground truth.
          </p>
          <div className="flex flex-col gap-3.5">
            {[
              { value: percent(stats.aquaPaired, stats.aqua), label: "MODIS Aqua detections with a VIIRS partner", note: `${fmt(stats.aquaPaired)} of ${fmt(stats.aqua)}` },
              { value: percent(0, stats.terra), label: "MODIS Terra detections with a VIIRS partner", note: `Terra passes about 3 h before VIIRS, so it cannot pair within ±${MATCHING_RULE.maxMinutes} min` },
              { value: percent(stats.viirsPaired, stats.viirs), label: "VIIRS detections with a MODIS partner", note: `${fmt(stats.viirsPaired)} of ${fmt(stats.viirs)}` },
              { value: `${comparison.medianKm.toFixed(2)} km`, label: "Median distance apart" },
              { value: `${Math.round(comparison.medianMinutes)} min`, label: "Median time difference" },
              { value: stats.modis ? (stats.viirs / stats.modis).toFixed(1) : "–", label: "VIIRS to MODIS detection ratio" },
            ].map((metric) => (
              <div key={metric.label}>
                <div className="big-metric num">{metric.value}</div>
                <div className="text-xs">{metric.label}</div>
                {metric.note ? <div className="muted text-[11px]">{metric.note}</div> : null}
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Seen by one sensor only">
          <SplitBars rows={[{ label: "VIIRS only", value: stats.viirsOnly, color: "var(--hot)" }, { label: "MODIS only", value: stats.modisOnly, color: "var(--cool)" }]} />
          <p className="muted mt-2.5 mb-0 text-[11px]">
            A detection missing from one sensor is not necessarily an error. The sensors differ in resolution and overpass time.
          </p>
        </Panel>

        <Panel title="Data and provenance">
          <Provenance
            rows={[
              ["MODIS product", "MCD14ML, C6.1 (placeholder)"],
              ["VIIRS product", "VNP14IMG, 375 m (placeholder)"],
              ["Satellites", "Terra, Aqua, S-NPP, NOAA-20/21"],
              ["Period on record", `Jan ${FIRST_YEAR} – Dec ${LAST_YEAR}`],
              ["Matching rule", `≤ ${MATCHING_RULE.maxKm} km and ± ${MATCHING_RULE.maxMinutes} min`],
            ]}
          />
          <button className="btn sm mt-3.5" type="button" onClick={() => exportMonth(ds, mi, resolveArea(view, ds.world))}>
            Export month as CSV
          </button>
        </Panel>
      </aside>

      {tip ? (
        <div className="tip" role="tooltip" style={{ left: tip.x, top: tip.y }}>
          {monthLabel(tip.m)} · {fmt(values[tip.m])} {noun}
          {monthMedian(tip.m % 12) ? ` · ${(values[tip.m] / monthMedian(tip.m % 12)).toFixed(2)}× median` : ""}
        </div>
      ) : null}
    </main>
  );
}
