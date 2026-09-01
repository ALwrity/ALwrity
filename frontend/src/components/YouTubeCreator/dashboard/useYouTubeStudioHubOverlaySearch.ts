/**
 * Hub Search filters overlay: TYPE, Duration, Upload Date, and Features.
 * Chip-row search stays in YouTubeStudioHub.
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

type OverlaySearchFns = {
  searchYouTubeByType: (
    query: string,
    searchType: YouTubeSearchTypeFilter,
  ) => Promise<YouTubeHubSearchResult>;
  searchYouTubeByDuration: (
    query: string,
    duration: YouTubeSearchDurationFilter,
  ) => Promise<YouTubeHubSearchResult>;
  searchYouTubeByUploadDate: (
    query: string,
    uploadDate: YouTubeSearchUploadDateFilter,
  ) => Promise<YouTubeHubSearchResult>;
  searchYouTubeByFeature: (
    query: string,
    feature: YouTubeSearchFeatureFilter,
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

  const handleSearchTypeChange = useCallback(
    async (searchTypeNext: YouTubeSearchTypeFilter) => {
      try {
        setSearchType(searchTypeNext);
        setSearchDuration(undefined);
        setSearchFeature(undefined);
        const query = searchQuery.trim();
        if (!query) {
          console.info("[YouTubeStudioHub] Search type skipped empty query", {
            searchType: searchTypeNext,
          });
          return;
        }
        console.info("[YouTubeStudioHub] Search type changed", {
          searchType: searchTypeNext,
          queryLength: query.length,
        });
        setSearchMessage("Searching...");
        const result = await overlaySearch.searchYouTubeByType(query, searchTypeNext);
        setSearchItems(result.items);
        setSearchMessage(result.message);
      } catch (error) {
        console.error("[YouTubeStudioHub] Search type request failed", error);
        setSearchItems([]);
        setSearchMessage("Search failed.");
      }
    },
    [searchQuery, setSearchItems, setSearchMessage, overlaySearch],
  );

  const handleSearchDurationChange = useCallback(
    async (durationNext: YouTubeSearchDurationFilter) => {
      try {
        setSearchDuration(durationNext);
        setSearchType(undefined);
        setSearchFeature(undefined);
        const query = searchQuery.trim();
        if (!query) {
          console.info("[YouTubeStudioHub] Search duration skipped empty query", {
            videoDuration: durationNext,
          });
          return;
        }
        console.info("[YouTubeStudioHub] Search duration changed", {
          videoDuration: durationNext,
          queryLength: query.length,
        });
        setSearchMessage("Searching...");
        const result = await overlaySearch.searchYouTubeByDuration(query, durationNext);
        setSearchItems(result.items);
        setSearchMessage(result.message);
        console.info("[YouTubeStudioHub] Search duration complete", {
          videoDuration: durationNext,
          itemCount: result.items.length,
          hasMessage: Boolean(result.message),
        });
      } catch (error) {
        console.error(
          "[YouTubeStudioHub] Search duration request failed",
          {
            videoDuration: durationNext,
            queryLength: searchQuery.trim().length,
          },
          error,
        );
        setSearchItems([]);
        setSearchMessage("Search failed.");
      }
    },
    [searchQuery, setSearchItems, setSearchMessage, overlaySearch],
  );

  const handleSearchUploadDateChange = useCallback(
    async (uploadDateNext: YouTubeSearchUploadDateFilter) => {
      try {
        setSearchUploadDate(uploadDateNext);
        const query = searchQuery.trim();
        if (!query) {
          console.info("[YouTubeStudioHub] Search upload date skipped empty query", {
            uploadDate: uploadDateNext,
          });
          return;
        }
        console.info("[YouTubeStudioHub] Search upload date changed", {
          uploadDate: uploadDateNext,
          queryLength: query.length,
        });
        setSearchMessage("Searching...");
        const result = await overlaySearch.searchYouTubeByUploadDate(query, uploadDateNext);
        setSearchItems(result.items);
        setSearchMessage(result.message);
        console.info("[YouTubeStudioHub] Search upload date complete", {
          uploadDate: uploadDateNext,
          itemCount: result.items.length,
          hasMessage: Boolean(result.message),
        });
      } catch (error) {
        console.error(
          "[YouTubeStudioHub] Search upload date request failed",
          {
            uploadDate: uploadDateNext,
            queryLength: searchQuery.trim().length,
          },
          error,
        );
        setSearchItems([]);
        setSearchMessage("Search failed.");
      }
    },
    [searchQuery, setSearchItems, setSearchMessage, overlaySearch],
  );

  const handleSearchFeatureChange = useCallback(
    async (featureNext: YouTubeSearchFeatureFilter) => {
      try {
        setSearchFeature(featureNext);
        setSearchType(undefined);
        setSearchDuration(undefined);
        const query = searchQuery.trim();
        if (!query) {
          console.info("[YouTubeStudioHub] Search feature skipped empty query", {
            videoFeature: featureNext,
          });
          return;
        }
        console.info("[YouTubeStudioHub] Search feature changed", {
          videoFeature: featureNext,
          queryLength: query.length,
        });
        setSearchMessage("Searching...");
        const result = await overlaySearch.searchYouTubeByFeature(query, featureNext);
        setSearchItems(result.items);
        setSearchMessage(result.message);
        console.info("[YouTubeStudioHub] Search feature complete", {
          videoFeature: featureNext,
          itemCount: result.items.length,
          hasMessage: Boolean(result.message),
        });
      } catch (error) {
        console.error(
          "[YouTubeStudioHub] Search feature request failed",
          {
            videoFeature: featureNext,
            queryLength: searchQuery.trim().length,
          },
          error,
        );
        setSearchItems([]);
        setSearchMessage("Search failed.");
      }
    },
    [searchQuery, setSearchItems, setSearchMessage, overlaySearch],
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
