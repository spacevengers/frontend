"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { resolveArea } from "@/lib/area";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";
import { exportMonth } from "@/lib/export";
import { loadDataset } from "@/lib/sample/dataset";
import { setTheme, useTheme } from "@/lib/theme";
import { parseViewState } from "@/lib/view-state";

const VIEWS = [
  { href: "/", label: "Globe" },
  { href: "/map", label: "Map" },
  { href: "/calendar", label: "Calendar and comparison" },
  { href: "/about", label: "About the data" },
];

function Brand({ href }: { href: string }) {
  return (
    <Link className="brand" href={href}>
      <svg width="30" height="30" viewBox="0 0 28 28" aria-hidden="true">
        <circle cx="14" cy="14" r="12" fill="none" stroke="var(--hot)" strokeWidth="1.4" opacity=".45" />
        <circle cx="14" cy="14" r="7" fill="none" stroke="var(--hot)" strokeWidth="1.4" />
        <circle cx="14" cy="14" r="2.6" fill="var(--fg)" />
      </svg>
      <div>
        <b>{APP_NAME}</b>
        <small>{APP_TAGLINE}</small>
      </div>
    </Link>
  );
}

function Shell({ query, pathname, onExport }: { query: string; pathname: string | null; onExport?: () => void }) {
  const theme = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  const suffix = query ? `?${query}` : "";
  return (
    <header className="header">
      <Brand href={`/${suffix}`} />
      <nav className="nav" aria-label="Views">
        {VIEWS.map((v) => (
          <Link key={v.href} href={`${v.href}${suffix}`} aria-current={pathname === v.href ? "page" : undefined}>
            {v.label}
          </Link>
        ))}
      </nav>
      <div className="actions">
        <span className="tag">Sample data</span>
        <button className="btn" type="button" onClick={() => setTheme(next)} aria-label={`Switch to ${next} theme`}>
          <span aria-hidden="true">{next === "light" ? "☀" : "☾"}</span>
          <span>{next === "light" ? "Light theme" : "Dark theme"}</span>
        </button>
        <button className="btn solid" type="button" onClick={onExport} disabled={!onExport}>
          Export
        </button>
      </div>
    </header>
  );
}

export function Header() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  async function onExport() {
    const view = parseViewState(new URLSearchParams(window.location.search));
    const ds = await loadDataset();
    exportMonth(ds, view.mi, resolveArea(view, ds.world));
  }

  return <Shell query={searchParams.toString()} pathname={pathname} onExport={onExport} />;
}

export function HeaderFallback() {
  return <Shell query="" pathname={null} />;
}
