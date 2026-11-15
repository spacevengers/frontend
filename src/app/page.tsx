import { Suspense } from "react";
import { GlobeScreen } from "@/components/screens/GlobeScreen";

export default function Home() {
  return (
    <Suspense fallback={<main className="stage" aria-busy="true" />}>
      <GlobeScreen />
    </Suspense>
  );
}
