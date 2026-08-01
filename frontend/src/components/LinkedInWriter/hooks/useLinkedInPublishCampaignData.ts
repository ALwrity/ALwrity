import { useCallback, useEffect, useState } from "react";
import { apiClient } from "../../../api/client";
import { contentPlanningApi } from "../../../services/contentPlanningApi";
import {
  buildPublishCampaignPayload,
  type CalendarEventRecord,
  type PublishCampaignHorizon,
  type PublishCampaignPayload,
} from "../utils/publishCampaignUtils";
import type { LinkedInDraftAsset } from "../utils/linkedInDraftLibraryUtils";

const ASSET_FETCH_LIMIT = 50;

interface UseLinkedInPublishCampaignDataResult {
  data: PublishCampaignPayload | null;
  loading: boolean;
  error: string;
  horizonDays: PublishCampaignHorizon;
  setHorizonDays: (days: PublishCampaignHorizon) => void;
  refresh: () => void;
}

export function useLinkedInPublishCampaignData(
  open: boolean,
): UseLinkedInPublishCampaignDataResult {
  const [horizonDays, setHorizonDays] = useState<PublishCampaignHorizon>(7);
  const [data, setData] = useState<PublishCampaignPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [eventsRaw, assetsRes] = await Promise.all([
        contentPlanningApi.getEvents(),
        apiClient.get("/api/content-assets/", {
          params: {
            source_module: "linkedin_writer",
            limit: ASSET_FETCH_LIMIT,
            sort_by: "created_at",
            sort_order: "desc",
          },
        }),
      ]);

      const eventsList: CalendarEventRecord[] = Array.isArray(eventsRaw)
        ? eventsRaw
        : (eventsRaw?.events ?? eventsRaw?.data ?? []);

      const assetsData = assetsRes.data;
      const assets: LinkedInDraftAsset[] = Array.isArray(assetsData)
        ? assetsData
        : (assetsData?.assets ?? []);

      setData(buildPublishCampaignPayload(eventsList, assets, horizonDays));
    } catch (e) {
      console.error("[PublishCampaign] load failed:", e);
      setError("Could not load campaign data. Please try again.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [horizonDays]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  return {
    data,
    loading,
    error,
    horizonDays,
    setHorizonDays,
    refresh: load,
  };
}
