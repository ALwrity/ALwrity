import { useCallback, useEffect, useState } from "react";
import {
  linkedInGrowthApi,
  type ConsolidatedGrowthResponse,
} from "../../../../services/linkedInGrowthApi";
import {
  readGrowthCache,
  writeGrowthCache,
} from "./engagementWedgeGrowthCache";

/** Shared hook for Engagement wedge modals that load the full growth cache (e.g. Opportunities). */
export function useGrowthCache(open: boolean) {
  const [data, setData] = useState<ConsolidatedGrowthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const c = readGrowthCache();
    setData(c ? c.data : null);
    setError("");
    setLoading(false);
  }, [open]);

  const loadAll = useCallback(
    async (errMsg = "Could not load insights. Please try again.") => {
      setLoading(true);
      setError("");
      try {
        const result = await linkedInGrowthApi.analyzeAll();
        writeGrowthCache(result);
        setData(result);
        return result;
      } catch {
        setError(errMsg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { data, loading, error, loadAll };
}
