"use client";

import { useEffect, useState } from "react";
import { type Dataset, loadDataset } from "./dataset";

export type DatasetState =
  | { status: "loading"; ds: null; error: null }
  | { status: "ready"; ds: Dataset; error: null }
  | { status: "error"; ds: null; error: string };

export function useDataset(): DatasetState {
  const [state, setState] = useState<DatasetState>({ status: "loading", ds: null, error: null });
  useEffect(() => {
    let cancelled = false;
    loadDataset().then(
      (ds) => {
        if (!cancelled) setState({ status: "ready", ds, error: null });
      },
      (err: unknown) => {
        if (!cancelled) setState({ status: "error", ds: null, error: err instanceof Error ? err.message : String(err) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}
