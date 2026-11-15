import type { Metadata } from "next";
import { Suspense } from "react";
import { MapScreen } from "@/components/screens/MapScreen";

export const metadata: Metadata = { title: "Map" };

export default function MapPage() {
  return (
    <Suspense fallback={<main className="stage with-filterbar" aria-busy="true" />}>
      <MapScreen />
    </Suspense>
  );
}
