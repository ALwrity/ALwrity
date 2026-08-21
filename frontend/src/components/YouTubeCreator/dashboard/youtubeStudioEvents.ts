/**
 * YouTube Studio Hub ↔ Video Creator deep-link event bus.
 */
import type { DurationType } from "../constants";
import type { YouTubeChannelBible } from "../../../services/youtubeApi";
import type { YouTubeWorkflowCardId } from "./youtubeWorkflowConfig";

export const YT_OPEN_CREATOR_EVENT = "youtube:openCreator";
export const YT_OPEN_WEDGE_EVENT = "youtube:openWorkflowWedge";
export const YT_RESUME_DRAFT_EVENT = "youtube:resumeDraft";
export const YT_SWITCH_TAB_EVENT = "youtube:switchTab";
export const YT_OPEN_CHANNEL_BIBLE_EVENT = "youtube:openChannelBible";
export const YT_CHANNEL_BIBLE_UPDATED_EVENT = "youtube:channelBibleUpdated";

export type YouTubeStudioTab = "hub" | "creator";

/** Missing or unknown query values default to Video Creator — never Hub. */
export function parseYouTubeStudioTab(raw: string | null | undefined): YouTubeStudioTab {
  return raw === "hub" ? "hub" : "creator";
}

export interface YouTubeOpenCreatorDetail {
  step?: number;
  durationType?: DurationType;
  userIdea?: string;
  focusUrlImport?: boolean;
  /** Expand Plan brainstorm (Topic Discovery). */
  focusBrainstorm?: boolean;
  /** Expand brainstorm and load saved ideas. */
  focusSavedIdeas?: boolean;
}

export interface YouTubeOpenWedgeDetail {
  wedge: YouTubeWorkflowCardId;
  sub?: string;
}

/** Pending open detail for Tab 1 when it mounts after a hub deep-link. */
let pendingOpenCreator: YouTubeOpenCreatorDetail | null = null;
const PENDING_STORAGE_KEY = "yt_pending_open_creator";

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

export function openYouTubeCreator(detail: YouTubeOpenCreatorDetail = {}): void {
  queueYouTubeCreatorOpen(detail);
  window.dispatchEvent(
    new CustomEvent<YouTubeOpenCreatorDetail>(YT_OPEN_CREATOR_EVENT, {
      detail,
    }),
  );
  // Do not switch to Video Creator tab — Studio Hub opens Full Creator modal.
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
