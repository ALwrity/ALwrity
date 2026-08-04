import { useCallback, useState } from "react";
import { showToastNotification } from "../../../utils/toastNotifications";
import {
  ANALYSIS_WEDGE_NOTIFY_KEYS,
  type AnalysisWedgeLockedFeature,
} from "../utils/linkedInAnalysisWedgeLockedUi";

function readNotifyState() {
  return {
    seo_analytics:
      localStorage.getItem(ANALYSIS_WEDGE_NOTIFY_KEYS.seo_analytics) === "1",
  };
}

/** Plan-wedge-style "Notify me" state for locked Analysis wedge features. */
export function useAnalysisWedgeNotify() {
  const [notifyRequested, setNotifyRequested] = useState(readNotifyState);

  const handleNotify = useCallback(
    (feature: AnalysisWedgeLockedFeature, label: string) => {
      try {
        localStorage.setItem(ANALYSIS_WEDGE_NOTIFY_KEYS[feature], "1");
        setNotifyRequested((prev) => ({ ...prev, [feature]: true }));
        showToastNotification(
          `You're on the list — we'll notify you when ${label} launches.`,
          "success",
        );
        console.debug("[AnalysisWedge] notify requested", { feature, label });
      } catch (err) {
        console.warn("[AnalysisWedge] failed to persist notify preference", err);
        showToastNotification(
          "Could not save your preference. Please try again.",
          "error",
        );
      }
    },
    [],
  );

  return { notifyRequested, handleNotify };
}
