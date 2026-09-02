/**
 * Hub Search filters overlay: TYPE, Duration, Upload Date, and Features.
 * Compatible columns combine into one Search.list. Chip-row search stays in Hub.
 */
import { useCallback, useState } from "react";
import type {
  YouTubeSearchDurationFilter,
  YouTubeSearchFeatureFilter,
  YouTubeSearchHit,
  YouTubeSearchTypeFilter,
  YouTubeSearchUploadDateFilter,
} from "./YouTubeSearchResultsPanel";
import type { YouTubeHubSearchResult } from "./youtubeHubSearchRequests";
import {
  resolveYouTubeSearchOverlayCombine,
  type YouTubeSearchOverlayChange,
  type YouTubeSearchOverlaySelection,
} from "./youtubeSearchOverlayCombine";

type OverlaySearchFns = {
  searchYouTubeByOverlay: (
    query: string,
    selection: YouTubeSearchOverlaySelection,
  ) => Promise<YouTubeHubSearchResult>;
};

export function useYouTubeStudioHubOverlaySearch(
  searchQuery: string,
  setSearchItems: (items: YouTubeSearchHit[]) => void,
  setSearchMessage: (message: string | null) => void,
  overlaySearch: OverlaySearchFns,
) {
  const [searchType, setSearchType] = useState<YouTubeSearchTypeFilter | undefined>(
    undefined,
  );
  const [searchDuration, setSearchDuration] = useState<
    YouTubeSearchDurationFilter | undefined
  >(undefined);
  const [searchUploadDate, setSearchUploadDate] = useState<
    YouTubeSearchUploadDateFilter | undefined
  >(undefined);
  const [searchFeature, setSearchFeature] = useState<
    YouTubeSearchFeatureFilter | undefined
  >(undefined);

  const applyOverlayChange = useCallback(
    async (change: YouTubeSearchOverlayChange) => {
      const current: YouTubeSearchOverlaySelection = {
        searchType,
        duration: searchDuration,
        uploadDate: searchUploadDate,
        feature: searchFeature,
      };
      try {
        const resolved = resolveYouTubeSearchOverlayCombine(current, change);
        setSearchType(resolved.searchType);
        setSearchDuration(resolved.duration);
        setSearchUploadDate(resolved.uploadDate);
        setSearchFeature(resolved.feature);
        const query = searchQuery.trim();
        if (!query) {
          console.info("[YouTubeStudioHub] Overlay search skipped empty query", {
            field: change.field,
          });
          return;
        }
        console.info("[YouTubeStudioHub] Overlay search changed", {
          field: change.field,
          searchType: resolved.searchType || null,
          duration: resolved.duration || null,
          uploadDate: resolved.uploadDate || null,
          feature: resolved.feature || null,
          queryLength: query.length,
        });
        setSearchMessage("Searching...");
        const result = await overlaySearch.searchYouTubeByOverlay(query, resolved);
        setSearchItems(result.items);
        setSearchMessage(result.message);
        console.info("[YouTubeStudioHub] Overlay search complete", {
          field: change.field,
          itemCount: result.items.length,
          hasMessage: Boolean(result.message),
        });
      } catch (error) {
        console.error(
          "[YouTubeStudioHub] Overlay search request failed",
          { field: change.field, queryLength: searchQuery.trim().length },
          error,
        );
        setSearchItems([]);
        setSearchMessage("Search failed.");
      }
    },
    [
      searchQuery,
      searchType,
      searchDuration,
      searchUploadDate,
      searchFeature,
      setSearchItems,
      setSearchMessage,
      overlaySearch,
    ],
  );

  const handleSearchTypeChange = useCallback(
    (searchTypeNext: YouTubeSearchTypeFilter) =>
      applyOverlayChange({ field: "type", value: searchTypeNext }),
    [applyOverlayChange],
  );

  const handleSearchDurationChange = useCallback(
    (durationNext: YouTubeSearchDurationFilter) =>
      applyOverlayChange({ field: "duration", value: durationNext }),
    [applyOverlayChange],
  );

  const handleSearchUploadDateChange = useCallback(
    (uploadDateNext: YouTubeSearchUploadDateFilter) =>
      applyOverlayChange({ field: "uploadDate", value: uploadDateNext }),
    [applyOverlayChange],
  );

  const handleSearchFeatureChange = useCallback(
    (featureNext: YouTubeSearchFeatureFilter) =>
      applyOverlayChange({ field: "feature", value: featureNext }),
    [applyOverlayChange],
  );

  return {
    searchType,
    setSearchType,
    searchDuration,
    setSearchDuration,
    searchUploadDate,
    setSearchUploadDate,
    searchFeature,
    setSearchFeature,
    handleSearchTypeChange,
    handleSearchDurationChange,
    handleSearchUploadDateChange,
    handleSearchFeatureChange,
  };
}
