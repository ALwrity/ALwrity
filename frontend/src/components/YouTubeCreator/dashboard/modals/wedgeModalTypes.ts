import type { YouTubeOpenCreatorDetail } from "../youtubeStudioEvents";
import type { YouTubeCreatorState } from "../../../../hooks/useYouTubeCreatorState";

export type GoCreateFn = (detail?: YouTubeOpenCreatorDetail) => void;

export interface WedgeModalBaseProps {
  open: boolean;
  onClose: () => void;
  goCreate: GoCreateFn;
}

export interface PlanWedgeProps extends WedgeModalBaseProps {
  channelBibleNiche?: string | null;
  onOpenBible: () => void;
}

export interface CreateWedgeProps extends WedgeModalBaseProps {
  creatorState: YouTubeCreatorState;
  onOpenSeo: () => void;
  onOpenThumb: () => void;
}

export interface PublishWedgeProps extends WedgeModalBaseProps {
  creatorState: YouTubeCreatorState;
  onOpenDrafts: () => void;
  onOpenCoach: () => void;
  onOpenCost: () => void;
  onOpenSchedule: () => void;
  onOpenPlaylist: () => void;
}

export interface AnalysisWedgeProps extends WedgeModalBaseProps {
  onOpenPulse: () => void;
  onOpenStale: () => void;
  onOpenSeo: () => void;
  onOpenGaps: () => void;
  onOpenRetention: () => void;
}

export interface EngagementWedgeProps extends WedgeModalBaseProps {
  creatorState: YouTubeCreatorState;
  onOpenComments: () => void;
  onOpenCommunity: () => void;
}

export interface RemarketWedgeProps extends WedgeModalBaseProps {
  creatorState: YouTubeCreatorState;
  onOpenStale: () => void;
  onNavigateBlog: () => void;
  onNavigateLibrary: () => void;
}
