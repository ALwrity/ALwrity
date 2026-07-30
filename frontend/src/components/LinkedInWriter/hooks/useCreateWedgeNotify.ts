import { useCallback, useState } from "react";
import { showToastNotification } from "../../../utils/toastNotifications";
import {
  CREATE_WEDGE_NOTIFY_KEYS,
  type CreateWedgeLockedContentType,
} from "../utils/linkedInConnectLockedUi";

function readNotifyState() {
  return {
    carousel:
      localStorage.getItem(CREATE_WEDGE_NOTIFY_KEYS.carousel) === "1",
    video_script:
      localStorage.getItem(CREATE_WEDGE_NOTIFY_KEYS.video_script) === "1",
  };
}

/** Plan-wedge-style "Notify me" state for locked Create wedge formats. */
export function useCreateWedgeNotify() {
  const [notifyRequested, setNotifyRequested] = useState(readNotifyState);

  const handleNotify = useCallback(
    (contentType: CreateWedgeLockedContentType, label: string) => {
      localStorage.setItem(CREATE_WEDGE_NOTIFY_KEYS[contentType], "1");
      setNotifyRequested((prev) => ({ ...prev, [contentType]: true }));
      showToastNotification(
        `You're on the list — we'll notify you when ${label} launches.`,
        "success",
      );
    },
    [],
  );

  return { notifyRequested, handleNotify };
}
