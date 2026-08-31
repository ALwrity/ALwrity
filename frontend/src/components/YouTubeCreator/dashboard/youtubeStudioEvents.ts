/**
 * YouTube Studio Hub ↔ Video Creator deep-link event bus.
 */
import type { DurationType } from "../constants";
import type { YouTubeChannelBible } from "../../../services/youtubeApi";
import type { YouTubeSourceArticle } from "../components/planUrlImportUtils";
import type { YouTubeWorkflowCardId } from "./youtubeWorkflowConfig";
import {
  queueYouTubePlanDrillDown,
  type YouTubePlanDrillDownDetail,
  type YouTubePlanDrillDownSub,
} from "./youtubePlanDrillDown";

export const YT_OPEN_CREATOR_EVENT = "youtube:openCreator";
export const YT_CLOSE_CREATOR_EVENT = "youtube:closeCreator";
export const YT_OPEN_WEDGE_EVENT = "youtube:openWorkflowWedge";
export const YT_RESUME_DRAFT_EVENT = "youtube:resumeDraft";
export const YT_SWITCH_TAB_EVENT = "youtube:switchTab";
export const YT_OPEN_CHANNEL_BIBLE_EVENT = "youtube:openChannelBible";
export const YT_CHANNEL_BIBLE_UPDATED_EVENT = "youtube:channelBibleUpdated";
export const YT_SEARCH_RESULTS_EVENT = "youtube:searchResults";

export type YouTubeStudioTab = "hub" | "creator";

export type { YouTubePlanDrillDownDetail, YouTubePlanDrillDownSub };

/**
 * Hub-only shell: any query (including legacy `?tab=creator`) resolves to Hub.
 * Legacy creator deep-links are rewritten by `useYouTubeCreatorLandingDeepLink`.
 */
export function parseYouTubeStudioTab(_raw?: string | null): YouTubeStudioTab {
  return "hub";
}

export interface YouTubeOpenCreatorDetail {
  step?: number;
  durationType?: DurationType;
  userIdea?: string;
  /** Article metadata for createPlan (from Plan Blog/URL → Use for video idea). */
  sourceArticle?: YouTubeSourceArticle;
  /** @deprecated Retargeted to Plan wedge url-import drill-down. */
  focusUrlImport?: boolean;
  /** @deprecated Retargeted to Plan Topic Discovery. */
  focusBrainstorm?: boolean;
  /** @deprecated Retargeted to Plan Saved Ideas drill-down. */
  focusSavedIdeas?: boolean;
}

export interface YouTubeOpenWedgeDetail {
  wedge: YouTubeWorkflowCardId;
  sub?: YouTubePlanDrillDownSub;
}

/** Pending open detail when Full Creator modal mounts after a deep-link. */
let pendingOpenCreator: YouTubeOpenCreatorDetail | null = null;
const PENDING_STORAGE_KEY = "yt_pending_open_creator";

export function peekPendingOpenCreator(): YouTubeOpenCreatorDetail | null {
  if (pendingOpenCreator) return pendingOpenCreator;
  try {
    const raw = sessionStorage.getItem(PENDING_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as YouTubeOpenCreatorDetail;
  } catch (err) {
    console.warn("[youtubeStudioEvents] peekPendingOpenCreator failed", err);
    return null;
  }
}

export function hasPendingOpenCreator(): boolean {
  return peekPendingOpenCreator() != null;
}

export function consumePendingOpenCreator(): YouTubeOpenCreatorDetail | null {
  let next = pendingOpenCreator;
  pendingOpenCreator = null;
  try {
    const raw = sessionStorage.getItem(PENDING_STORAGE_KEY);
    sessionStorage.removeItem(PENDING_STORAGE_KEY);
    if (!next && raw) {
      next = JSON.parse(raw) as YouTubeOpenCreatorDetail;
    }
  } catch {
    /* ignore */
  }
  return next;
}

export function queueYouTubeCreatorOpen(detail: YouTubeOpenCreatorDetail = {}): void {
  pendingOpenCreator = detail;
  try {
    sessionStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify(detail));
  } catch {
    /* ignore */
  }
}

export function openYouTubePlanFromCreator(
  detail: YouTubePlanDrillDownDetail = {},
): void {
  queueYouTubePlanDrillDown(detail);
  window.dispatchEvent(new CustomEvent(YT_CLOSE_CREATOR_EVENT));
  openYouTubeWorkflowWedge({
    wedge: "plan",
    sub: detail.sub,
  });
  console.info("[youtubeStudioEvents] openYouTubePlanFromCreator", detail);
}

export function openYouTubeCreator(detail: YouTubeOpenCreatorDetail = {}): void {
  // Discovery deep-links land on Plan wedge (single place for brainstorm / Blog/URL).
  if (detail.focusUrlImport || detail.focusBrainstorm || detail.focusSavedIdeas) {
    const sub: YouTubePlanDrillDownSub = detail.focusUrlImport
      ? "url-import"
      : detail.focusSavedIdeas
        ? "saved-ideas"
        : "brainstorm";
    openYouTubePlanFromCreator({
      sub,
      seed: typeof detail.userIdea === "string" ? detail.userIdea : undefined,
    });
    return;
  }

  queueYouTubeCreatorOpen(detail);
  window.dispatchEvent(
    new CustomEvent<YouTubeOpenCreatorDetail>(YT_OPEN_CREATOR_EVENT, {
      detail,
    }),
  );
  // Hub Full Creator surface host listens — do not switch tabs.
  console.info("[youtubeStudioEvents] openYouTubeCreator", detail);
}

export function openYouTubeWorkflowWedge(
  detail: YouTubeOpenWedgeDetail,
): void {
  window.dispatchEvent(
    new CustomEvent<YouTubeOpenWedgeDetail>(YT_OPEN_WEDGE_EVENT, { detail }),
  );
  window.dispatchEvent(
    new CustomEvent<{ tab: YouTubeStudioTab }>(YT_SWITCH_TAB_EVENT, {
      detail: { tab: "hub" },
    }),
  );
}

export function resumeYouTubeDraft(): void {
  const step = getYouTubeCreatorActiveStep();
  openYouTubeCreator({ step });
  window.dispatchEvent(new CustomEvent(YT_RESUME_DRAFT_EVENT));
  console.info("[youtubeStudioEvents] resumeYouTubeDraft", { step });
}

function getYouTubeCreatorActiveStep(): number {
  try {
    const raw = localStorage.getItem("youtube_creator_state");
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    return typeof parsed.activeStep === "number" ? parsed.activeStep : 0;
  } catch {
    return 0;
  }
}

export function switchYouTubeStudioTab(tab: YouTubeStudioTab): void {
  window.dispatchEvent(
    new CustomEvent<{ tab: YouTubeStudioTab }>(YT_SWITCH_TAB_EVENT, {
      detail: { tab },
    }),
  );
}

/** Open Channel Bible editor on Studio Hub (does not switch to Video Creator). */
export function openYouTubeChannelBible(): void {
  window.dispatchEvent(new CustomEvent(YT_OPEN_CHANNEL_BIBLE_EVENT));
  window.dispatchEvent(
    new CustomEvent<{ tab: YouTubeStudioTab }>(YT_SWITCH_TAB_EVENT, {
      detail: { tab: "hub" },
    }),
  );
}

/** Notify Hub shell + other surfaces after a successful bible save. */
export function notifyYouTubeChannelBibleUpdated(bible: YouTubeChannelBible): void {
  window.dispatchEvent(
    new CustomEvent<YouTubeChannelBible>(YT_CHANNEL_BIBLE_UPDATED_EVENT, {
      detail: bible,
    }),
  );
}

export type YouTubeSearchResultsDetail = {
  query: string;
  items: Array<{ video_id: string; title: string }>;
  message: string | null;
};

/** Header search bar publishes results for the Hub panel (not the header dropdown). */
export function publishYouTubeSearchResults(detail: YouTubeSearchResultsDetail): void {
  try {
    window.dispatchEvent(
      new CustomEvent<YouTubeSearchResultsDetail>(YT_SEARCH_RESULTS_EVENT, {
        detail,
      }),
    );
    console.info("[youtubeStudioEvents] publishYouTubeSearchResults", {
      queryLength: detail.query.length,
      itemCount: Array.isArray(detail.items) ? detail.items.length : 0,
      hasMessage: Boolean(detail.message),
    });
  } catch (error) {
    console.error("[youtubeStudioEvents] publishYouTubeSearchResults failed", error);
  }
}
