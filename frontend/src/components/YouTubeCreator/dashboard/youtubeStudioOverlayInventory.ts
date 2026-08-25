/**
 * YouTube Studio overlay ownership map + migration checklist.
 *
 * Phase 5: overlay contract tests + z-index guardrail. Hub main stays unisolated.
 */

export type YouTubeOverlayRenderKind =
  | "in_tree"
  | "mui_portal"
  | "custom_createPortal";

export type YouTubeOverlaySurface = "hub" | "full_creator" | "shared" | "css";

export type YouTubeOverlayMigrationAction =
  | "keep_leaf_hub_modal"
  | "full_creator_surface_landed"
  | "mui_native_restored"
  | "css_z_index_unified"
  | "isolation_removed"
  | "isolation_audited"
  | "review_unused_duplicate";

export interface YouTubeStudioOverlayEntry {
  id: string;
  component: string;
  sourceFile: string;
  renderKind: YouTubeOverlayRenderKind;
  surface: YouTubeOverlaySurface;
  zIndexSource: string;
  nestedUnderFullCreatorHost: boolean;
  knownIssue: string | null;
  migrationAction: YouTubeOverlayMigrationAction;
}

export const YOUTUBE_STUDIO_OVERLAY_INVENTORY: readonly YouTubeStudioOverlayEntry[] = [
  {
    id: "action-modal-shell",
    component: "YouTubeActionModal",
    sourceFile: "dashboard/YouTubeActionModal.tsx",
    renderKind: "custom_createPortal",
    surface: "hub",
    zIndexSource: "YT_Z_MODAL (13000) inline on YouTubeActionModal",
    nestedUnderFullCreatorHost: false,
    knownIssue:
      "Body portal at 13000 beats Knowledge Centre (12000). Do not host Full Creator here.",
    migrationAction: "keep_leaf_hub_modal",
  },
  {
    id: "full-creator-host",
    component: "YouTubeVideoCreatorModal",
    sourceFile: "dashboard/modals/YouTubeVideoCreatorModal.tsx",
    renderKind: "custom_createPortal",
    surface: "full_creator",
    zIndexSource: "YT_Z_CREATOR_SURFACE (1250); Hub chrome hidden via YT_CREATOR_SURFACE_BODY_CLASS",
    nestedUnderFullCreatorHost: false,
    knownIssue: null,
    migrationAction: "full_creator_surface_landed",
  },
  {
    id: "knowledge-center-desktop",
    component: "YouTubeKnowledgeCenter",
    sourceFile: "dashboard/YouTubeKnowledgeCenter.tsx",
    renderKind: "custom_createPortal",
    surface: "hub",
    zIndexSource: "YT_Z_KNOWLEDGE_CENTER (12000)",
    nestedUnderFullCreatorHost: false,
    knownIssue:
      "Must stay below studioModal. Do not raise to beat Full Creator; split the Creator surface instead.",
    migrationAction: "keep_leaf_hub_modal",
  },
  {
    id: "knowledge-center-mobile",
    component: "YouTubeKnowledgeCenter (mobile YouTubeActionModal)",
    sourceFile: "dashboard/YouTubeKnowledgeCenter.tsx",
    renderKind: "custom_createPortal",
    surface: "hub",
    zIndexSource: "YT_Z_MODAL",
    nestedUnderFullCreatorHost: false,
    knownIssue: null,
    migrationAction: "keep_leaf_hub_modal",
  },
  {
    id: "channel-bible-editor",
    component: "YouTubeChannelBibleEditorModal",
    sourceFile: "dashboard/YouTubeChannelBibleEditorModal.tsx",
    renderKind: "custom_createPortal",
    surface: "hub",
    zIndexSource: "YouTubeActionModal / YT_Z_MODAL",
    nestedUnderFullCreatorHost: false,
    knownIssue: null,
    migrationAction: "keep_leaf_hub_modal",
  },
  {
    id: "copilot-fab-modal",
    component: "YouTubeCopilotFab",
    sourceFile: "dashboard/YouTubeCopilotFab.tsx",
    renderKind: "custom_createPortal",
    surface: "hub",
    zIndexSource: "YouTubeActionModal / YT_Z_MODAL",
    nestedUnderFullCreatorHost: false,
    knownIssue: null,
    migrationAction: "keep_leaf_hub_modal",
  },
  {
    id: "plan-wedge",
    component: "PlanWedgeModal",
    sourceFile: "dashboard/modals/PlanWedgeModal.tsx",
    renderKind: "custom_createPortal",
    surface: "hub",
    zIndexSource: "YouTubeActionModal / YT_Z_MODAL",
    nestedUnderFullCreatorHost: false,
    knownIssue: null,
    migrationAction: "keep_leaf_hub_modal",
  },
  {
    id: "create-wedge",
    component: "CreateWedgeModal",
    sourceFile: "dashboard/modals/CreateWedgeModal.tsx",
    renderKind: "custom_createPortal",
    surface: "hub",
    zIndexSource: "YouTubeActionModal / YT_Z_MODAL",
    nestedUnderFullCreatorHost: false,
    knownIssue: null,
    migrationAction: "keep_leaf_hub_modal",
  },
  {
    id: "publish-wedge",
    component: "PublishWedgeModal",
    sourceFile: "dashboard/modals/PublishWedgeModal.tsx",
    renderKind: "custom_createPortal",
    surface: "hub",
    zIndexSource: "YouTubeActionModal / YT_Z_MODAL",
    nestedUnderFullCreatorHost: false,
    knownIssue: null,
    migrationAction: "keep_leaf_hub_modal",
  },
  {
    id: "analysis-wedge",
    component: "AnalysisWedgeModal",
    sourceFile: "dashboard/modals/AnalysisWedgeModal.tsx",
    renderKind: "custom_createPortal",
    surface: "hub",
    zIndexSource: "YouTubeActionModal / YT_Z_MODAL",
    nestedUnderFullCreatorHost: false,
    knownIssue: null,
    migrationAction: "keep_leaf_hub_modal",
  },
  {
    id: "engagement-wedge",
    component: "EngagementWedgeModal",
    sourceFile: "dashboard/modals/EngagementWedgeModal.tsx",
    renderKind: "custom_createPortal",
    surface: "hub",
    zIndexSource: "YouTubeActionModal / YT_Z_MODAL",
    nestedUnderFullCreatorHost: false,
    knownIssue: null,
    migrationAction: "keep_leaf_hub_modal",
  },
  {
    id: "remarket-wedge",
    component: "RemarketWedgeModal",
    sourceFile: "dashboard/modals/RemarketWedgeModal.tsx",
    renderKind: "custom_createPortal",
    surface: "hub",
    zIndexSource: "YouTubeActionModal / YT_Z_MODAL",
    nestedUnderFullCreatorHost: false,
    knownIssue: null,
    migrationAction: "keep_leaf_hub_modal",
  },
  {
    id: "workflow-helpers",
    component: "WorkflowHelperModals",
    sourceFile: "dashboard/modals/WorkflowHelperModals.tsx",
    renderKind: "custom_createPortal",
    surface: "hub",
    zIndexSource: "YouTubeActionModal / YT_Z_MODAL",
    nestedUnderFullCreatorHost: false,
    knownIssue: "Leaf Hub dialogs stacked on wedges; not a nested-app host.",
    migrationAction: "keep_leaf_hub_modal",
  },
  {
    id: "plan-url-import",
    component: "YouTubePlanUrlImportModal",
    sourceFile: "dashboard/modals/YouTubePlanUrlImportModal.tsx",
    renderKind: "custom_createPortal",
    surface: "hub",
    zIndexSource: "YouTubeActionModal / YT_Z_MODAL",
    nestedUnderFullCreatorHost: false,
    knownIssue: null,
    migrationAction: "keep_leaf_hub_modal",
  },
  {
    id: "plan-saved-ideas",
    component: "YouTubePlanSavedIdeasModal",
    sourceFile: "dashboard/modals/YouTubePlanSavedIdeasModal.tsx",
    renderKind: "custom_createPortal",
    surface: "hub",
    zIndexSource: "YouTubeActionModal / YT_Z_MODAL",
    nestedUnderFullCreatorHost: false,
    knownIssue: null,
    migrationAction: "keep_leaf_hub_modal",
  },
  {
    id: "comment-assistant",
    component: "CommentAssistantModal",
    sourceFile: "dashboard/modals/CommentAssistantModal.tsx",
    renderKind: "custom_createPortal",
    surface: "hub",
    zIndexSource: "YouTubeActionModal / YT_Z_MODAL",
    nestedUnderFullCreatorHost: false,
    knownIssue: null,
    migrationAction: "keep_leaf_hub_modal",
  },
  {
    id: "stale-refresh",
    component: "StaleRefreshModal",
    sourceFile: "dashboard/modals/StaleRefreshModal.tsx",
    renderKind: "custom_createPortal",
    surface: "hub",
    zIndexSource: "YouTubeActionModal / YT_Z_MODAL",
    nestedUnderFullCreatorHost: false,
    knownIssue: null,
    migrationAction: "keep_leaf_hub_modal",
  },
  {
    id: "playlist-attach",
    component: "PlaylistAttachModal",
    sourceFile: "dashboard/modals/PlaylistAttachModal.tsx",
    renderKind: "custom_createPortal",
    surface: "hub",
    zIndexSource: "YouTubeActionModal / YT_Z_MODAL",
    nestedUnderFullCreatorHost: false,
    knownIssue: null,
    migrationAction: "keep_leaf_hub_modal",
  },
  {
    id: "community-ideas",
    component: "CommunityIdeasModal",
    sourceFile: "dashboard/modals/CommunityIdeasModal.tsx",
    renderKind: "custom_createPortal",
    surface: "hub",
    zIndexSource: "YouTubeActionModal / YT_Z_MODAL",
    nestedUnderFullCreatorHost: false,
    knownIssue: null,
    migrationAction: "keep_leaf_hub_modal",
  },
  {
    id: "retention",
    component: "RetentionModal",
    sourceFile: "dashboard/modals/RetentionModal.tsx",
    renderKind: "custom_createPortal",
    surface: "hub",
    zIndexSource: "YouTubeActionModal / YT_Z_MODAL",
    nestedUnderFullCreatorHost: false,
    knownIssue: null,
    migrationAction: "keep_leaf_hub_modal",
  },
  {
    id: "content-gaps",
    component: "ContentGapsModal",
    sourceFile: "dashboard/modals/ContentGapsModal.tsx",
    renderKind: "custom_createPortal",
    surface: "hub",
    zIndexSource: "YouTubeActionModal / YT_Z_MODAL",
    nestedUnderFullCreatorHost: false,
    knownIssue: null,
    migrationAction: "keep_leaf_hub_modal",
  },
  {
    id: "schedule-publish",
    component: "SchedulePublishModal",
    sourceFile: "dashboard/modals/SchedulePublishModal.tsx",
    renderKind: "custom_createPortal",
    surface: "hub",
    zIndexSource: "YouTubeActionModal / YT_Z_MODAL",
    nestedUnderFullCreatorHost: false,
    knownIssue: null,
    migrationAction: "keep_leaf_hub_modal",
  },
  {
    id: "channel-pulse",
    component: "ChannelPulseModal",
    sourceFile: "dashboard/modals/ChannelPulseModal.tsx",
    renderKind: "custom_createPortal",
    surface: "hub",
    zIndexSource: "YouTubeActionModal / YT_Z_MODAL",
    nestedUnderFullCreatorHost: false,
    knownIssue: null,
    migrationAction: "keep_leaf_hub_modal",
  },
  {
    id: "scene-image-settings",
    component: "YouTubeImageGenerationModal via GenerationModals",
    sourceFile: "components/SceneCard/GenerationModals.tsx",
    renderKind: "mui_portal",
    surface: "full_creator",
    zIndexSource: "MUI Dialog default (~1300) in shared ImageGenerationModal",
    nestedUnderFullCreatorHost: true,
    knownIssue: null,
    migrationAction: "mui_native_restored",
  },
  {
    id: "scene-audio-settings",
    component: "AudioSettingsModal via GenerationModals",
    sourceFile: "components/SceneCard/GenerationModals.tsx",
    renderKind: "mui_portal",
    surface: "full_creator",
    zIndexSource: "MUI Dialog default (~1300)",
    nestedUnderFullCreatorHost: true,
    knownIssue: null,
    migrationAction: "mui_native_restored",
  },
  {
    id: "youtube-audio-settings-duplicate",
    component: "AudioSettingsModal (YouTube-local, unused by GenerationModals)",
    sourceFile: "components/AudioSettingsModal.tsx",
    renderKind: "mui_portal",
    surface: "full_creator",
    zIndexSource: "MUI Dialog default (~1300)",
    nestedUnderFullCreatorHost: true,
    knownIssue:
      "Unused by GenerationModals (shared AudioSettingsModal is live). Same nested-z risk if wired.",
    migrationAction: "review_unused_duplicate",
  },
  {
    id: "scene-preview",
    component: "ScenePreviewModal",
    sourceFile: "components/ScenePreviewModal.tsx",
    renderKind: "mui_portal",
    surface: "full_creator",
    zIndexSource: "MUI Dialog default (~1300)",
    nestedUnderFullCreatorHost: true,
    knownIssue: null,
    migrationAction: "mui_native_restored",
  },
  {
    id: "start-new-video-confirm",
    component: "StartNewVideoButton",
    sourceFile: "components/StartNewVideoButton.tsx",
    renderKind: "mui_portal",
    surface: "full_creator",
    zIndexSource: "MUI Dialog default (~1300); also used from Hub toolbar",
    nestedUnderFullCreatorHost: true,
    knownIssue: null,
    migrationAction: "mui_native_restored",
  },
  {
    id: "avatar-lightbox",
    component: "AvatarCard Dialog",
    sourceFile: "components/AvatarCard.tsx",
    renderKind: "mui_portal",
    surface: "full_creator",
    zIndexSource: "MUI Dialog default (~1300)",
    nestedUnderFullCreatorHost: true,
    knownIssue: null,
    migrationAction: "mui_native_restored",
  },
  {
    id: "render-snackbar",
    component: "RenderStep Snackbar",
    sourceFile: "components/RenderStep.tsx",
    renderKind: "mui_portal",
    surface: "full_creator",
    zIndexSource: "MUI Snackbar default (~1400)",
    nestedUnderFullCreatorHost: true,
    knownIssue: null,
    migrationAction: "mui_native_restored",
  },
  {
    id: "plan-select-menus",
    component: "selectMenuProps (PlanStep, SelectWithCustom)",
    sourceFile: "styles.ts",
    renderKind: "mui_portal",
    surface: "full_creator",
    zIndexSource: "MUI Menu default (~1300)",
    nestedUnderFullCreatorHost: true,
    knownIssue: null,
    migrationAction: "mui_native_restored",
  },
  {
    id: "plan-tooltips",
    component: "tooltipPopperProps",
    sourceFile: "styles.ts",
    renderKind: "mui_portal",
    surface: "full_creator",
    zIndexSource: "MUI Tooltip default (~1500)",
    nestedUnderFullCreatorHost: true,
    knownIssue: null,
    migrationAction: "mui_native_restored",
  },
  {
    id: "css-modal-backdrop-duplicate",
    component: ".yt-modal-backdrop",
    sourceFile: "dashboard/youtube-dashboard-layout.css",
    renderKind: "in_tree",
    surface: "css",
    zIndexSource: "No CSS z-index; YouTubeActionModal inline YT_Z_MODAL is source of truth",
    nestedUnderFullCreatorHost: false,
    knownIssue: null,
    migrationAction: "css_z_index_unified",
  },
  {
    id: "css-hub-isolation",
    component: ".yt-studio-hub-main",
    sourceFile: "dashboard/youtube-dashboard-layout.css",
    renderKind: "in_tree",
    surface: "css",
    zIndexSource: "No isolation (Phase 4). Shares .yt-studio-hub stacking with rail.",
    nestedUnderFullCreatorHost: false,
    knownIssue: null,
    migrationAction: "isolation_removed",
  },
  {
    id: "css-hub-toolbar",
    component: ".yt-studio-hub-toolbar",
    sourceFile: "dashboard/youtube-dashboard-layout.css",
    renderKind: "in_tree",
    surface: "css",
    zIndexSource: "z-index: 25 (in-tree Hub chrome vs rail 24)",
    nestedUnderFullCreatorHost: false,
    knownIssue: null,
    migrationAction: "isolation_audited",
  },
  {
    id: "css-mobile-fab",
    component: "mobile studio FAB",
    sourceFile: "dashboard/youtube-dashboard-layout.css",
    renderKind: "in_tree",
    surface: "css",
    zIndexSource: "z-index: 1200 (YT_Z_MOBILE_FAB, in-tree; below MUI modal)",
    nestedUnderFullCreatorHost: false,
    knownIssue: null,
    migrationAction: "isolation_audited",
  },
];

export function getYouTubeOverlaysByKind(
  kind: YouTubeOverlayRenderKind,
): YouTubeStudioOverlayEntry[] {
  return YOUTUBE_STUDIO_OVERLAY_INVENTORY.filter((entry) => entry.renderKind === kind);
}

export function getYouTubeOverlaysNestedUnderFullCreator(): YouTubeStudioOverlayEntry[] {
  return YOUTUBE_STUDIO_OVERLAY_INVENTORY.filter((entry) => entry.nestedUnderFullCreatorHost);
}

export function getYouTubeOverlayMigrationChecklist(): Array<{
  id: string;
  component: string;
  action: YouTubeOverlayMigrationAction;
  blockedUntilPhase: 2 | 3 | 4 | "none";
}> {
  return YOUTUBE_STUDIO_OVERLAY_INVENTORY.map((entry) => {
    const blockedUntilPhase =
      entry.migrationAction === "keep_leaf_hub_modal" ||
      entry.migrationAction === "full_creator_surface_landed" ||
      entry.migrationAction === "mui_native_restored" ||
      entry.migrationAction === "css_z_index_unified" ||
      entry.migrationAction === "isolation_removed" ||
      entry.migrationAction === "isolation_audited"
        ? "none"
        : entry.migrationAction === "review_unused_duplicate"
          ? 4
          : 2;
    return {
      id: entry.id,
      component: entry.component,
      action: entry.migrationAction,
      blockedUntilPhase,
    };
  });
}
