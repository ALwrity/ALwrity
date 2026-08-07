import { useCallback, useState } from "react";
import { showToastNotification } from "../../../utils/toastNotifications";
import {
  GROW_NETWORK_NOTIFY_KEYS,
  type GrowNetworkLockedSection,
} from "../utils/growNetworkLockedUi";

function readNotifyState() {
  return {
    network_advisor:
      localStorage.getItem(GROW_NETWORK_NOTIFY_KEYS.network_advisor) === "1",
  };
}

/** "Notify me" state for locked Grow Network sections (Create wedge pattern). */
export function useGrowNetworkNotify() {
  const [notifyRequested, setNotifyRequested] = useState(readNotifyState);

  const handleNotify = useCallback(
    (section: GrowNetworkLockedSection, label: string) => {
      localStorage.setItem(GROW_NETWORK_NOTIFY_KEYS[section], "1");
      setNotifyRequested((prev) => ({ ...prev, [section]: true }));
      showToastNotification(
        `You're on the list — we'll notify you when ${label} launches.`,
        "success",
      );
    },
    [],
  );

  return { notifyRequested, handleNotify };
}
