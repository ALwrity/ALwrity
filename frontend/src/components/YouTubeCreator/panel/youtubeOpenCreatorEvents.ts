import type { DurationType } from "../constants";

/** Shared with Studio Hub later; Video Creator listens without mounting hub UI. */
export const YT_OPEN_CREATOR_EVENT = "youtube:openCreator";
const PENDING_STORAGE_KEY = "yt_pending_open_creator";

export interface YouTubeOpenCreatorDetail {
  step?: number;
  durationType?: DurationType;
  userIdea?: string;
  focusUrlImport?: boolean;
}

let pendingOpenCreator: YouTubeOpenCreatorDetail | null = null;

export function consumePendingOpenCreator(): YouTubeOpenCreatorDetail | null {
  let next = pendingOpenCreator;
  pendingOpenCreator = null;
  if (!next) {
    try {
      const raw = sessionStorage.getItem(PENDING_STORAGE_KEY);
      if (raw) {
        next = JSON.parse(raw) as YouTubeOpenCreatorDetail;
        sessionStorage.removeItem(PENDING_STORAGE_KEY);
      }
    } catch {
      /* ignore */
    }
  }
  return next;
}
