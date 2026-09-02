/**
 * Combine Search filters overlay: keep compatible columns, drop illegal pairs.
 * Last click on a conflict wins. Tap the selected option again to clear that column.
 * Upload Date is never a video-only switch.
 */
import type {
  YouTubeSearchDurationFilter,
  YouTubeSearchFeatureFilter,
  YouTubeSearchTypeFilter,
  YouTubeSearchUploadDateFilter,
} from "./YouTubeSearchResultsPanel";

export type YouTubeSearchOverlaySelection = {
  searchType?: YouTubeSearchTypeFilter;
  duration?: YouTubeSearchDurationFilter;
  uploadDate?: YouTubeSearchUploadDateFilter;
  feature?: YouTubeSearchFeatureFilter;
};

export type YouTubeSearchOverlayChange =
  | { field: "type"; value: YouTubeSearchTypeFilter }
  | { field: "duration"; value: YouTubeSearchDurationFilter }
  | { field: "uploadDate"; value: YouTubeSearchUploadDateFilter }
  | { field: "feature"; value: YouTubeSearchFeatureFilter };

const CHANNEL_PLAYLIST = new Set<YouTubeSearchTypeFilter>(["channel", "playlist"]);

function compactSelection(
  selection: YouTubeSearchOverlaySelection,
): YouTubeSearchOverlaySelection {
  const compact: YouTubeSearchOverlaySelection = {};
  if (selection.searchType) compact.searchType = selection.searchType;
  if (selection.duration) compact.duration = selection.duration;
  if (selection.uploadDate) compact.uploadDate = selection.uploadDate;
  if (selection.feature) compact.feature = selection.feature;
  return compact;
}

function currentValueForField(
  current: YouTubeSearchOverlaySelection,
  field: YouTubeSearchOverlayChange["field"],
): string | undefined {
  if (field === "type") return current.searchType;
  if (field === "duration") return current.duration;
  if (field === "uploadDate") return current.uploadDate;
  return current.feature;
}

function clearField(
  selection: YouTubeSearchOverlaySelection,
  field: YouTubeSearchOverlayChange["field"],
): YouTubeSearchOverlaySelection {
  const next = { ...selection };
  if (field === "type") delete next.searchType;
  else if (field === "duration") delete next.duration;
  else if (field === "uploadDate") delete next.uploadDate;
  else delete next.feature;
  return next;
}

function logCombineComplete(
  field: YouTubeSearchOverlayChange["field"],
  compact: YouTubeSearchOverlaySelection,
  extra?: Record<string, boolean>,
): void {
  console.info("[youtubeSearchOverlayCombine] Combine complete", {
    field,
    searchType: compact.searchType || null,
    duration: compact.duration || null,
    uploadDate: compact.uploadDate || null,
    feature: compact.feature || null,
    ...extra,
  });
}

export function resolveYouTubeSearchOverlayCombine(
  current: YouTubeSearchOverlaySelection,
  change: YouTubeSearchOverlayChange,
): YouTubeSearchOverlaySelection {
  try {
    console.info("[youtubeSearchOverlayCombine] Combine start", {
      field: change.field,
      hasSearchType: Boolean(current.searchType),
      hasDuration: Boolean(current.duration),
      hasUploadDate: Boolean(current.uploadDate),
      hasFeature: Boolean(current.feature),
    });
    const next: YouTubeSearchOverlaySelection = { ...current };

    if (currentValueForField(current, change.field) === change.value) {
      const compact = compactSelection(clearField(next, change.field));
      console.info("[youtubeSearchOverlayCombine] Cleared selected filter", {
        field: change.field,
      });
      logCombineComplete(change.field, compact, { cleared: true });
      return compact;
    }

    if (change.field === "uploadDate") {
      next.uploadDate = change.value;
      const compact = compactSelection(next);
      logCombineComplete(change.field, compact);
      return compact;
    }

    if (change.field === "type") {
      next.searchType = change.value;
      if (CHANNEL_PLAYLIST.has(change.value)) {
        console.info("[youtubeSearchOverlayCombine] Dropping video filters for type", {
          searchType: change.value,
        });
        delete next.duration;
        delete next.feature;
      } else if (change.value === "shorts") {
        console.info("[youtubeSearchOverlayCombine] Dropping Duration for Shorts type");
        delete next.duration;
      }
      const compactType = compactSelection(next);
      logCombineComplete(change.field, compactType);
      return compactType;
    }

    if (change.field === "duration") {
      next.duration = change.value;
      if (
        next.searchType === "channel" ||
        next.searchType === "playlist" ||
        next.searchType === "shorts"
      ) {
        console.info("[youtubeSearchOverlayCombine] Duration clears incompatible TYPE", {
          previousSearchType: next.searchType,
        });
        delete next.searchType;
      }
      const compactDuration = compactSelection(next);
      logCombineComplete(change.field, compactDuration);
      return compactDuration;
    }

    next.feature = change.value;
    if (next.searchType === "channel" || next.searchType === "playlist") {
      console.info("[youtubeSearchOverlayCombine] FEATURES clears incompatible TYPE", {
        previousSearchType: next.searchType,
      });
      delete next.searchType;
    }
    const compact = compactSelection(next);
    logCombineComplete(change.field, compact);
    return compact;
  } catch (error) {
    console.error(
      "[youtubeSearchOverlayCombine] Combine failed",
      { field: change.field },
      error,
    );
    return compactSelection(current);
  }
}
