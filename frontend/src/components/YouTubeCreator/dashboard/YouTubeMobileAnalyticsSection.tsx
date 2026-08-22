import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import AnalyticsIcon from "@mui/icons-material/Analytics";
import CollectionsBookmarkIcon from "@mui/icons-material/CollectionsBookmark";
import { YouTubeActionModal } from "./YouTubeActionModal";
import { YouTubeAnalyticsSidebar } from "./YouTubeAnalyticsSidebar";
import { YouTubeKnowledgeCenter } from "./YouTubeKnowledgeCenter";
import { ConnectLockBadge } from "../../LinkedInWriter/components/dashboard/ConnectLockIcon";

interface YouTubeMobileAnalyticsSectionProps {
  connected: boolean;
  channelName?: string | null;
  onConnect: () => void;
  needsAnalyticsReconnect?: boolean;
}

interface MobileCircleActionProps {
  label: string;
  ariaLabel: string;
  onClick: () => void;
  tourTarget?: string;
  connectLocked?: boolean;
  children: React.ReactNode;
}

const MobileCircleAction: React.FC<MobileCircleActionProps> = ({
  label,
  ariaLabel,
  onClick,
  tourTarget,
  connectLocked = false,
  children,
}) => (
  <button
    type="button"
    className={[
      "yt-mobile-analytics-icon-btn",
      connectLocked && "yt-studio-connect-locked",
    ]
      .filter(Boolean)
      .join(" ")}
    data-tour={tourTarget}
    onClick={onClick}
    aria-label={ariaLabel}
    title={connectLocked ? `Connect YouTube to use ${label}` : label}
  >
    <span className="yt-mobile-analytics-icon-btn-circle" aria-hidden>
      {children}
    </span>
    <span className="yt-mobile-analytics-icon-btn-label">{label}</span>
    {connectLocked && (
      <ConnectLockBadge size={10} className="yt-mobile-analytics-icon-btn__lock" />
    )}
  </button>
);

/**
 * Mobile landing row — Analytics, Knowledge Centre, Library (LinkedIn M-17 pattern).
 * Channel Pulse opens in a modal; no mock stats.
 */
export const YouTubeMobileAnalyticsSection: React.FC<
  YouTubeMobileAnalyticsSectionProps
> = ({
  connected,
  channelName,
  onConnect,
  needsAnalyticsReconnect = false,
}) => {
  const navigate = useNavigate();
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  const openLibrary = () => {
    navigate("/asset-library?source_module=youtube_creator");
  };

  return (
    <>
      <section
        className="yt-mobile-analytics-section"
        aria-label="Analytics, Knowledge Centre, and Library"
        data-tour="yt-mobile-analytics"
      >
        <div className="yt-mobile-analytics-actions">
          <MobileCircleAction
            label="Analytics"
            ariaLabel="View channel pulse"
            onClick={() => {
              console.info("[YouTubeMobileAnalytics] Open Channel Pulse", {
                connected,
              });
              setAnalyticsOpen(true);
            }}
            connectLocked={!connected}
            tourTarget="yt-mobile-analytics-icon"
          >
            <AnalyticsIcon fontSize="medium" />
          </MobileCircleAction>

          <YouTubeKnowledgeCenter variant="mobileCircle" />

          <MobileCircleAction
            label="Library"
            ariaLabel="Open content library"
            onClick={openLibrary}
            tourTarget="yt-mobile-library-icon"
          >
            <CollectionsBookmarkIcon fontSize="medium" />
          </MobileCircleAction>
        </div>
      </section>

      <YouTubeActionModal
        open={analyticsOpen}
        title="Channel Pulse"
        onClose={() => setAnalyticsOpen(false)}
        maxWidth={440}
      >
        <YouTubeAnalyticsSidebar
          connected={connected}
          channelName={channelName}
          onConnect={() => {
            setAnalyticsOpen(false);
            onConnect();
          }}
          needsAnalyticsReconnect={needsAnalyticsReconnect}
        />
      </YouTubeActionModal>
    </>
  );
};
