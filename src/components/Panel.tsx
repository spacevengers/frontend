import type { ReactNode } from "react";

export function Panel({ title, aside, children, className }: { title: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel${className ? ` ${className}` : ""}`}>
      <div className="panel-title">
        <span>{title}</span>
        {aside ? <span className="muted font-normal">{aside}</span> : null}
      </div>
      <div className="panel-body">{children}</div>
    </section>
  );
}

export function SplitBars({ rows }: { rows: { label: string; value: number; color: string }[] }) {
  const total = rows.reduce((sum, r) => sum + r.value, 0) || 1;
  return (
    <div className="split">
      {rows.map((r) => (
        <div className="row" key={r.label}>
          <span>{r.label}</span>
          <span className="num">{Math.round(r.value).toLocaleString("en-US")}</span>
          <span className="track">
            <i style={{ width: `${(r.value / total) * 100}%`, background: r.color }} />
          </span>
        </div>
      ))}
    </div>
  );
}

export function Provenance({ rows }: { rows: [label: string, value: ReactNode][] }) {
  return (
    <dl className="kv">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function LoadState({ status, error }: { status: "loading" | "error"; error?: string | null }) {
  return (
    <p className="muted" role={status === "error" ? "alert" : "status"}>
      {status === "loading" ? "Loading records…" : `Could not load the data. ${error ?? ""}`}
    </p>
  );
}
