"use client";

import { useMemo } from "react";
import { type Area, parseBbox, resolveArea } from "@/lib/area";
import type { World } from "@/lib/geo/world";
import type { ViewState } from "@/lib/view-state";

export function useArea(world: World | null, view: ViewState): Area | null {
  const { country } = view;
  const bboxKey = view.bbox ? view.bbox.join(",") : null;
  return useMemo(
    () => (world ? resolveArea({ country, bbox: parseBbox(bboxKey) }, world) : null),
    [world, country, bboxKey],
  );
}
