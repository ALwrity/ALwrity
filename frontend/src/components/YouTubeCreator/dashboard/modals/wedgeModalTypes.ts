import type { YouTubeOpenCreatorDetail } from "../youtubeStudioEvents";
import type { YouTubeCreatorState } from "../../../../hooks/useYouTubeCreatorState";
import type { YouTubeChannelBible } from "../../../../services/youtubeApi";

export type GoCreateFn = (detail?: YouTubeOpenCreatorDetail) => void;

export interface WedgeModalBaseProps {
  open: boolean;
  onClose: () => void;
  goCreate: GoCreateFn;
}

/** Optional OAuth gate props — no-ops while STUDIO_HUB_UNLOCK_ALL_FOR_TESTING is on. */
export interface GatedWedgeProps extends WedgeModalBaseProps {
  connected: boolean;
  onRequestConnect: () => void;
}

export interface PlanWedgeProps extends WedgeModalBaseProps {
  markNotify?: (key: string) => void;
  notifyKeys?: Record<string, boolean>;
  channelBible?: YouTubeChannelBible | null;
  planAvatarUrl?: string | null;
  onChannelBibleSaved?: (bible: YouTubeChannelBible) => void;
  onCreatorDraftPatched?: (state: YouTubeCreatorState) => void;
}

export interface CreateWedgeProps extends WedgeModalBaseProps {
  creatorState: YouTubeCreatorState;
  onOpenSeo: () => void;
  onOpenThumb: () => void;
  /** Opens Full Creator modal on Hub (no Video Creator tab switch). */
  onOpenFullCreator: () => void;
}

export interface PublishWedgeProps extends GatedWedgeProps {
  creatorState: YouTubeCreatorState;
  onOpenDrafts: () => void;
  onOpenCoach: () => void;
  onOpenCost: () => void;
  onOpenSchedule: () => void;
  onOpenPlaylist: () => void;
}

export interface AnalysisWedgeProps extends GatedWedgeProps {
  onOpenPulse: () => void;
  onOpenStale: () => void;
  onOpenSeo: () => void;
  onOpenGaps: () => void;
  onOpenRetention: () => void;
}

export interface EngagementWedgeProps extends GatedWedgeProps {
  creatorState: YouTubeCreatorState;
  onOpenComments: () => void;
  onOpenCommunity: () => void;
}

export interface RemarketWedgeProps extends GatedWedgeProps {
  creatorState: YouTubeCreatorState;
  onOpenStale: () => void;
  onNavigateBlog: () => void;
  onNavigateLibrary: () => void;
}
