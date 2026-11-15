import type { Metadata } from "next";
import { Suspense } from "react";
import { CalendarScreen } from "@/components/screens/CalendarScreen";

export const metadata: Metadata = { title: "Calendar and comparison" };

export default function CalendarPage() {
  return (
    <Suspense fallback={<main className="cal-wrap" aria-busy="true" />}>
      <CalendarScreen />
    </Suspense>
  );
}
