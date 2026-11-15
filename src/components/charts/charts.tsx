"use client";

import { useId } from "react";
import { MONTHS } from "@/lib/period";

interface Series {
  name: string;
  color: string;
  values: number[];
}

export function AreaChart({ series, highlight = -1, width = 320, height = 150 }: { series: Series[]; highlight?: number; width?: number; height?: number }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const pl = 28, pr = 6, pt = 8, pb = 18;
  const max = Math.max(1, ...series.flatMap((s) => s.values)) * 1.08;
  const x = (i: number) => pl + (i * (width - pl - pr)) / 11;
  const y = (v: number) => pt + (height - pt - pb) * (1 - v / max);
  const ticks = [0, 1, 2, 3].map((i) => (max / 3) * i);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${series.map((s) => s.name).join(", ")} by month`} className="block h-auto w-full">
      <defs>
        <filter id={`${id}-glow`} x="-10%" y="-30%" width="120%" height="160%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {series.map((s, k) => (
          <linearGradient key={s.name} id={`${id}-${k}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={s.color} stopOpacity=".42" />
            <stop offset="1" stopColor={s.color} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={pl} x2={width - pr} y1={y(v)} y2={y(v)} stroke="var(--line)" />
          <text x={pl - 5} y={y(v) + 3} fontSize="8.5" fill="var(--muted)" textAnchor="end">
            {v >= 1000 ? `${(v / 1000).toFixed(1)}k` : Math.round(v)}
          </text>
        </g>
      ))}
      {highlight >= 0 ? <rect x={x(highlight) - 7} y={pt} width="14" height={height - pt - pb} fill="var(--chip)" /> : null}
      {series.map((s, k) => {
        const points = s.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
        return (
          <g key={s.name}>
            <polygon points={`${x(0)},${y(0)} ${points} ${x(11)},${y(0)}`} fill={`url(#${id}-${k})`} />
            <polyline points={points} fill="none" stroke={s.color} strokeWidth="1.6" filter={`url(#${id}-glow)`} />
          </g>
        );
      })}
      {MONTHS.map((m, i) => (
        <text key={m} x={x(i)} y={height - 4} fontSize="8.5" fill="var(--muted)" textAnchor="middle">
          {m[0]}
        </text>
      ))}
    </svg>
  );
}

interface HistogramProps {
  bins: number[];
  label: string;
  color?: string;
  ticks?: [number, string][];
  median?: { at: number; text: string };
  width?: number;
  height?: number;
}

export function Histogram({ bins, label, color = "var(--hot)", ticks = [], median, width = 260, height = 120 }: HistogramProps) {
  const pl = 4, pr = 4, pt = 16, pb = 16;
  const max = Math.max(...bins) || 1;
  const bw = (width - pl - pr) / bins.length;
  const at = (pos: number) => pl + pos * (width - pl - pr);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      {bins.map((v, i) => {
        const bh = ((height - pt - pb) * v) / max;
        return <rect key={i} x={pl + i * bw + 1} y={height - pb - bh} width={bw - 2} height={bh} rx="1.5" fill={color} opacity={0.45 + 0.55 * (v / max)} />;
      })}
      <line x1={pl} x2={width - pr} y1={height - pb} y2={height - pb} stroke="var(--line-strong)" />
      {ticks.map(([pos, text]) => (
        <text key={text} x={at(pos)} y={height - 3} fontSize="9" fill="var(--muted)" textAnchor={pos <= 0 ? "start" : pos >= 1 ? "end" : "middle"}>
          {text}
        </text>
      ))}
      {median ? (
        <>
          <line x1={at(median.at)} x2={at(median.at)} y1={pt - 4} y2={height - pb} stroke="var(--fg)" strokeDasharray="3 3" />
          <text x={at(median.at) + 4} y={pt - 6} fontSize="9.5" fill="var(--fg)">
            {median.text}
          </text>
        </>
      ) : null}
    </svg>
  );
}

export function FrpScatter({ points, width = 260, height = 200 }: { points: [number, number][]; width?: number; height?: number }) {
  const pl = 30, pr = 6, pt = 8, pb = 24;
  const hi = Math.log10(200);
  const sx = (v: number) => pl + (Math.log10(Math.max(v, 1)) / hi) * (width - pl - pr);
  const sy = (v: number) => height - pb - (Math.log10(Math.max(v, 1)) / hi) * (height - pt - pb);
  const midY = (pt + height - pb) / 2;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="MODIS FRP against summed VIIRS FRP, log scales">
      {[1, 10, 100].map((v) => (
        <g key={v}>
          <line x1={sx(v)} x2={sx(v)} y1={pt} y2={height - pb} stroke="var(--line)" />
          <line x1={pl} x2={width - pr} y1={sy(v)} y2={sy(v)} stroke="var(--line)" />
          <text x={sx(v)} y={height - pb + 11} fontSize="8.5" fill="var(--muted)" textAnchor="middle">{v}</text>
          <text x={pl - 4} y={sy(v) + 3} fontSize="8.5" fill="var(--muted)" textAnchor="end">{v}</text>
        </g>
      ))}
      <line x1={sx(1)} y1={sy(1)} x2={sx(200)} y2={sy(200)} stroke="var(--fg)" strokeDasharray="4 4" opacity=".6" />
      {points.map(([a, b], i) => (
        <circle key={i} cx={sx(a).toFixed(1)} cy={sy(b).toFixed(1)} r="2.1" fill="var(--hot)" opacity=".55" />
      ))}
      <text x={(pl + width) / 2} y={height - 2} fontSize="9" fill="var(--muted)" textAnchor="middle">VIIRS FRP summed in footprint, MW</text>
      <text x="10" y={midY} fontSize="9" fill="var(--muted)" textAnchor="middle" transform={`rotate(-90 10 ${midY})`}>MODIS FRP, MW</text>
    </svg>
  );
}
