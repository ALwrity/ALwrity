import { useCallback, useState } from "react";
import { showToastNotification } from "../../../utils/toastNotifications";
import {
  PUBLISH_WEDGE_NOTIFY_KEYS,
  type PublishWedgeLockedFeature,
} from "../utils/linkedInPublishWedgeLockedUi";

function readNotifyState() {
  return {
    publish_campaign:
      localStorage.getItem(PUBLISH_WEDGE_NOTIFY_KEYS.publish_campaign) === "1",
  };
}

/** "Notify me" state for locked Publish wedge features. */
export function usePublishWedgeNotify() {
  const [notifyRequested, setNotifyRequested] = useState(readNotifyState);

  const handleNotify = useCallback(
    (feature: PublishWedgeLockedFeature, label: string) => {
      localStorage.setItem(PUBLISH_WEDGE_NOTIFY_KEYS[feature], "1");
      setNotifyRequested((prev) => ({ ...prev, [feature]: true }));
      showToastNotification(
        `You're on the list — we'll notify you when ${label} launches.`,
        "success",
      );
    },
    [],
  );

  return { notifyRequested, handleNotify };
}
