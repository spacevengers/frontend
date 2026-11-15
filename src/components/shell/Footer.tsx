import Link from "next/link";

export function Footer() {
  return (
    <footer className="footer">
      <span>
        Hotspots are satellite detections, not confirmed fires. Harmonized records are not ground truth, and this tool
        does not replace official fire products or emergency-response systems.
      </span>
      <span>
        Imagery and detections: NASA GIBS and{" "}
        <a href="https://earthdata.nasa.gov/firms" target="_blank" rel="noreferrer">
          NASA FIRMS
        </a>{" "}
        · Borders: Natural Earth · <Link href="/about">Sources and acknowledgments</Link>
      </span>
    </footer>
  );
}
