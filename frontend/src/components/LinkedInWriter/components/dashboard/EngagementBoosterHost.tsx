import React, { useEffect, useState } from "react";
import { useLinkedInSocialConnection } from "../../../../hooks/useLinkedInSocialConnection";
import {
  OPEN_ENGAGEMENT_BOOSTER_EVENT,
  type OpenEngagementBoosterDetail,
} from "../../utils/linkedInDashboardEvents";
import { EngagementBoosterModal } from "./EngagementBoosterModal";

/**
 * Single global Engagement Booster instance — opened from Quality Check,
 * editor toolbar, and dashboard events without duplicating modal state.
 */
export const EngagementBoosterHost: React.FC = () => {
  const { connected } = useLinkedInSocialConnection();
  const [open, setOpen] = useState(false);
  const [initialContent, setInitialContent] = useState<string | undefined>();

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<OpenEngagementBoosterDetail>).detail;
      setInitialContent(detail?.initialContent?.trim() || undefined);
      setOpen(true);
    };

    window.addEventListener(OPEN_ENGAGEMENT_BOOSTER_EVENT, handler);
    return () =>
      window.removeEventListener(OPEN_ENGAGEMENT_BOOSTER_EVENT, handler);
  }, []);

  const handleClose = () => {
    setOpen(false);
    setInitialContent(undefined);
  };

  return (
    <EngagementBoosterModal
      open={open}
      onClose={handleClose}
      connected={connected}
      initialContent={initialContent}
    />
  );
};
