import type { YouTubeStudioOverlayEntry } from "./youtubeStudioOverlayInventory";

/** Leaf overlay for Analysis Video Analytics chrome (kept off the 500-line inventory file). */
export const YOUTUBE_VIDEO_ANALYTICS_OVERLAY_ENTRIES: readonly YouTubeStudioOverlayEntry[] =
  [
    {
      id: "video-analytics",
      component: "YouTubeVideoAnalyticsModal",
      sourceFile: "dashboard/modals/YouTubeVideoAnalyticsModal.tsx",
      renderKind: "custom_createPortal",
      surface: "hub",
      zIndexSource: "YouTubeActionModal / YT_Z_MODAL",
      nestedUnderFullCreatorHost: false,
      knownIssue: null,
      migrationAction: "keep_leaf_hub_modal",
    },
  ];
