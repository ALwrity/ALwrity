/**
 * Phase 0 inventory for Video Creator tab → Full Creator modal migration.
 *
 * UX is unchanged until later PRs. This module is the single checklist so
 * later PRs retarget every caller without duplicating panel/API/backend code.
 *
 * Product contract (locked):
 * - All Video Creator features stay in existing YouTubeVideoCreatorPanel.
 * - Primary Create-wedge entry: "New Video (Full)".
 * - Shorts / Title Lab / Script Coach / Resume Draft open the SAME modal.
 * - Close modal → Studio Hub. `/youtube-creator` → always Hub (later PR).
 * - No new backend routes or duplicated youtube API layers.
 */

export const YOUTUBE_CREATOR_MODAL_MIGRATION_PHASE = 0 as const;

export type YouTubeCreatorMigrationPhase = 0 | 1 | 2 | 3 | 4 | 5;

/** How the pipeline is reached today (Phase 0 baseline on main). */
export type YouTubeCreatorEntryMechanism =
  | "goCreate"
  | "openYouTubeCreator"
  | "resumeYouTubeDraft"
  | "queueYouTubeCreatorOpen+navigate"
  | "navigate_only"
  | "shell_tab";

export interface YouTubeCreatorEntryPoint {
  id: string;
  /** Human label matching UI where applicable. */
  label: string;
  sourceFile: string;
  mechanism: YouTubeCreatorEntryMechanism;
  /** Prefill / open detail used today (or description if dynamic). */
  detailSummary: string;
  /**
   * PR phase that must retarget this entry to the Full Creator modal
   * (or Hub-only landing for navigate_only / shell_tab).
   */
  retargetInPhase: YouTubeCreatorMigrationPhase;
}

export interface YouTubeCreatorMigrationGuardrails {
  /** Mount YouTubeVideoCreatorPanel in at most one host at a time. */
  singlePanelMount: true;
  /** Do not add backend youtube routes or duplicate services. */
  noBackendChanges: true;
  /** Do not fork Plan/Scenes/Assets/Render into a second implementation. */
  reuseExistingPanel: true;
  /** Primary Create-wedge tile that opens Full Creator (step 0, medium). */
  primaryCreateTile: "New Video (Full)";
  /** Close Full Creator returns to Hub (not Create wedge). */
  closeReturnsToHub: true;
  /** Direct /youtube-creator is Hub-only after landing PR. */
  directRouteAlwaysHub: true;
}

/** Existing modules that must be reused — do not reimplement. */
export const YOUTUBE_CREATOR_MUST_REUSE = [
  "YouTubeVideoCreatorPanel",
  "useYouTubeCreatorState",
  "useYouTubeOpenCreatorPrefill",
  "youtubeApi",
  "youtubeStudioEvents (YouTubeOpenCreatorDetail + pending queue)",
  "YouTubeActionModal",
  "localStorage key youtube_creator_state",
] as const;

/** Large / sensitive files — avoid dumping migration logic into these. */
export const YOUTUBE_CREATOR_AVOID_INFLATING = [
  "components/PlanStep.tsx",
  "services/youtubeApi.ts",
  "components/CombinedSceneOverview.tsx",
] as const;

/**
 * Every known path into Video Creator as of Phase 0 (main baseline).
 * Later PRs retarget these without changing this inventory's caller list
 * except to update detailSummary / phase marker as work lands.
 */
export const YOUTUBE_CREATOR_ENTRY_POINTS: readonly YouTubeCreatorEntryPoint[] = [
  {
    id: "create-wedge-new-video-full",
    label: "New Video (Full)",
    sourceFile: "dashboard/modals/CreateWedgeModal.tsx",
    mechanism: "goCreate",
    detailSummary: "{ step: 0, durationType: 'medium' } — today switches to Video Creator tab",
    retargetInPhase: 1,
  },
  {
    id: "create-wedge-shorts",
    label: "Shorts Fast Path",
    sourceFile: "dashboard/modals/CreateWedgeModal.tsx",
    mechanism: "goCreate",
    detailSummary: "{ step: 0, durationType: 'shorts' }",
    retargetInPhase: 2,
  },
  {
    id: "create-wedge-title-hook",
    label: "Title & Hook Lab",
    sourceFile: "dashboard/modals/CreateWedgeModal.tsx",
    mechanism: "goCreate",
    detailSummary: "{ step: creatorState.videoPlan ? 1 : 0 }",
    retargetInPhase: 2,
  },
  {
    id: "create-wedge-script-coach",
    label: "Script / Scene Coach",
    sourceFile: "dashboard/modals/CreateWedgeModal.tsx",
    mechanism: "goCreate",
    detailSummary: "{ step: scenes.length > 0 ? 1 : 0 }",
    retargetInPhase: 2,
  },
  {
    id: "hub-connect-create-video",
    label: "Hub connect / Create video CTA",
    sourceFile: "dashboard/YouTubeStudioHub.tsx",
    mechanism: "openYouTubeCreator",
    detailSummary: "{ step: 0 }",
    retargetInPhase: 2,
  },
  {
    id: "hub-start-new-video",
    label: "Start New Video (hub)",
    sourceFile: "dashboard/YouTubeStudioHub.tsx",
    mechanism: "openYouTubeCreator",
    detailSummary: "clear draft then { step: 0 }",
    retargetInPhase: 2,
  },
  {
    id: "hub-resume-draft",
    label: "Resume Draft",
    sourceFile: "dashboard/YouTubeResumeDraftChip.tsx",
    mechanism: "resumeYouTubeDraft",
    detailSummary: "queue step from youtube_creator_state.activeStep + switch tab creator",
    retargetInPhase: 2,
  },
  {
    id: "knowledge-center-create",
    label: "Knowledge Center → create",
    sourceFile: "dashboard/YouTubeKnowledgeCenter.tsx",
    mechanism: "openYouTubeCreator",
    detailSummary: "{ step: 0 }",
    retargetInPhase: 2,
  },
  {
    id: "content-gaps-create-this",
    label: "Content Gaps → Create this",
    sourceFile: "dashboard/modals/ContentGapsModal.tsx",
    mechanism: "openYouTubeCreator",
    detailSummary: "{ step: 0, userIdea: gap.title, durationType: shorts|medium }",
    retargetInPhase: 2,
  },
  {
    id: "schedule-publish-go-render",
    label: "Schedule Publish → Creator step 3",
    sourceFile: "dashboard/modals/SchedulePublishModal.tsx",
    mechanism: "openYouTubeCreator",
    detailSummary: "{ step: 3 }",
    retargetInPhase: 2,
  },
  {
    id: "plan-wedge-idea-workspace",
    label: "Plan wedge idea → Creator",
    sourceFile: "dashboard/modals/YouTubePlanIdeaWorkspace.tsx",
    mechanism: "goCreate",
    detailSummary: "{ step: 0, userIdea: prompt }",
    retargetInPhase: 2,
  },
  {
    id: "plan-wedge-sidebar-tools",
    label: "Plan sidebar tools → Creator",
    sourceFile: "dashboard/modals/YouTubePlanSidebarTools.tsx",
    mechanism: "goCreate",
    detailSummary: "{ step: 0 }",
    retargetInPhase: 2,
  },
  {
    id: "publish-wedge-continue",
    label: "Publish wedge → continue / render",
    sourceFile: "dashboard/modals/PublishWedgeModal.tsx",
    mechanism: "goCreate",
    detailSummary: "activeStep or { step: 3 }",
    retargetInPhase: 2,
  },
  {
    id: "engagement-wedge-create",
    label: "Engagement wedge → Creator",
    sourceFile: "dashboard/modals/EngagementWedgeModal.tsx",
    mechanism: "goCreate",
    detailSummary: "{ step: videoPlan ? 1 : 0 }",
    retargetInPhase: 2,
  },
  {
    id: "remarket-winner-shorts",
    label: "Remarket → Winner Shorts",
    sourceFile: "dashboard/modals/RemarketWedgeModal.tsx",
    mechanism: "goCreate",
    detailSummary: "{ step: 0, durationType: 'shorts', userIdea }",
    retargetInPhase: 2,
  },
  {
    id: "remarket-perf-plan",
    label: "Remarket → Perf Plan",
    sourceFile: "dashboard/modals/RemarketWedgeModal.tsx",
    mechanism: "goCreate",
    detailSummary: "{ step: 0, userIdea from plan/title }",
    retargetInPhase: 2,
  },
  {
    id: "remarket-next-idea",
    label: "Remarket → next idea",
    sourceFile: "dashboard/modals/RemarketWedgeModal.tsx",
    mechanism: "goCreate",
    detailSummary: "{ step: 0, userIdea: nextIdea }",
    retargetInPhase: 2,
  },
  {
    id: "helper-coach-improve",
    label: "Pre-publish coach → Improve in Creator",
    sourceFile: "dashboard/modals/WorkflowHelperModals.tsx",
    mechanism: "goCreate",
    detailSummary: "{ step: videoPlan ? 1 : 0 }",
    retargetInPhase: 2,
  },
  {
    id: "helper-seo-edit",
    label: "SEO Pack helper → Creator",
    sourceFile: "dashboard/modals/WorkflowHelperModals.tsx",
    mechanism: "goCreate",
    detailSummary: "step 1 (or related plan step)",
    retargetInPhase: 2,
  },
  {
    id: "helper-thumb-related",
    label: "Thumbnail / related helper → Creator",
    sourceFile: "dashboard/modals/WorkflowHelperModals.tsx",
    mechanism: "goCreate",
    detailSummary: "step 0 / 2 depending on tile",
    retargetInPhase: 2,
  },
  {
    id: "workflow-goCreate-hub",
    label: "YouTubeWorkflowModals.goCreate",
    sourceFile: "dashboard/YouTubeWorkflowModals.tsx",
    mechanism: "openYouTubeCreator",
    detailSummary: "closes active wedge then openYouTubeCreator(detail) + switch tab creator",
    retargetInPhase: 2,
  },
  {
    id: "blog-create-youtube-video",
    label: "Blog Publish → Create YouTube video",
    sourceFile: "BlogWriter/BlogWriterUtils/PublishContent.tsx",
    mechanism: "queueYouTubeCreatorOpen+navigate",
    detailSummary: "queue { step: 0, userIdea, focusUrlImport } + /youtube-creator?tab=creator",
    retargetInPhase: 3,
  },
  {
    id: "dashboard-pillar-youtube",
    label: "MainDashboard GeneratePillarChips → YouTube",
    sourceFile: "MainDashboard/components/GeneratePillarChips.tsx",
    mechanism: "navigate_only",
    detailSummary: "navigate('/youtube-creator') — today defaults to creator tab",
    retargetInPhase: 3,
  },
  {
    id: "oauth-callback-redirect",
    label: "YouTube OAuth callback",
    sourceFile: "YouTubeCreator/YouTubeCallbackPage.tsx",
    mechanism: "navigate_only",
    detailSummary: "replace('/youtube-creator') — today defaults to creator tab",
    retargetInPhase: 3,
  },
  {
    id: "demo-landing-youtube",
    label: "demoMode youtube landing",
    sourceFile: "utils/demoMode.ts",
    mechanism: "navigate_only",
    detailSummary: "feature youtube → /youtube-creator",
    retargetInPhase: 3,
  },
  {
    id: "shell-video-creator-tab",
    label: "Video Creator tab (shell)",
    sourceFile: "YouTubeCreator/YouTubeCreator.tsx",
    mechanism: "shell_tab",
    detailSummary: "Tabs creator|hub; mounts YouTubeVideoCreatorPanel when tab!==hub",
    retargetInPhase: 4,
  },
] as const;

export const YOUTUBE_CREATOR_MIGRATION_GUARDRAILS: YouTubeCreatorMigrationGuardrails = {
  singlePanelMount: true,
  noBackendChanges: true,
  reuseExistingPanel: true,
  primaryCreateTile: "New Video (Full)",
  closeReturnsToHub: true,
  directRouteAlwaysHub: true,
};

/** Tests that assert current tab / open-creator behavior and must be updated in later PRs. */
export const YOUTUBE_CREATOR_MIGRATION_TESTS = [
  {
    file: "dashboard/youtubeStudioEvents.test.ts",
    notes:
      "parseYouTubeStudioTab defaults to creator today — change in landing PR; keep pending queue tests",
    touchInPhase: 3 as YouTubeCreatorMigrationPhase,
  },
  {
    file: "dashboard/__tests__/PlanWedgeModal.test.tsx",
    notes: "mocks goCreate — still valid; ensure modal open wiring covered in later PRs",
    touchInPhase: 2 as YouTubeCreatorMigrationPhase,
  },
  {
    file: "utils/__tests__/demoMode.pricing.test.ts",
    notes: "expects /youtube-creator landing — Hub-only after landing PR (route may stay same)",
    touchInPhase: 3 as YouTubeCreatorMigrationPhase,
  },
  {
    file: "components/StartNewVideoButton.test.tsx",
    notes: "button unit test; Hub onConfirm still calls openYouTubeCreator — retarget PR",
    touchInPhase: 2 as YouTubeCreatorMigrationPhase,
  },
] as const;

/** Planned file actions for later PRs (not applied in Phase 0 / this PR). */
export const YOUTUBE_CREATOR_MIGRATION_PLANNED_FILES = {
  create: [
    {
      path: "dashboard/modals/YouTubeVideoCreatorModal.tsx",
      reason: "Thin Full Creator modal host wrapping existing YouTubeVideoCreatorPanel",
      phase: 1 as YouTubeCreatorMigrationPhase,
    },
  ],
  modify: [
    {
      path: "dashboard/modals/CreateWedgeModal.tsx",
      reason: "New Video (Full) opens Full Creator modal",
      phase: 1 as YouTubeCreatorMigrationPhase,
    },
    {
      path: "dashboard/YouTubeWorkflowModals.tsx",
      reason: "Modal open state; close Create then open Full Creator; refresh Hub draft on close",
      phase: 1 as YouTubeCreatorMigrationPhase,
    },
    {
      path: "dashboard/modals/wedgeModalTypes.ts",
      reason: "Props for Full Creator open callback (if needed)",
      phase: 1 as YouTubeCreatorMigrationPhase,
    },
    {
      path: "dashboard/youtubeStudioEvents.ts",
      reason: "Stop switchTab(creator); open-modal contract for all callers",
      phase: 2 as YouTubeCreatorMigrationPhase,
    },
    {
      path: "dashboard/useYouTubeStudioTab.ts",
      reason: "Default Hub; legacy ?tab=creator → open modal",
      phase: 3 as YouTubeCreatorMigrationPhase,
    },
    {
      path: "BlogWriter/BlogWriterUtils/PublishContent.tsx",
      reason: "Deep-link without requiring creator tab",
      phase: 3 as YouTubeCreatorMigrationPhase,
    },
    {
      path: "YouTubeCreator.tsx",
      reason: "Hub-only shell; remove Video Creator tab",
      phase: 4 as YouTubeCreatorMigrationPhase,
    },
  ],
  neverDuplicate: [
    "YouTubeVideoCreatorPanel.tsx",
    "services/youtubeApi.ts",
    "hooks/useYouTubeCreatorState.ts",
    "backend/api/youtube/*",
  ],
} as const;

export function getYouTubeCreatorEntriesForPhase(
  phase: YouTubeCreatorMigrationPhase,
): YouTubeCreatorEntryPoint[] {
  return YOUTUBE_CREATOR_ENTRY_POINTS.filter((e) => e.retargetInPhase === phase);
}

export function getYouTubeCreatorPrimaryCreateEntry(): YouTubeCreatorEntryPoint {
  const entry = YOUTUBE_CREATOR_ENTRY_POINTS.find((e) => e.id === "create-wedge-new-video-full");
  if (!entry) {
    throw new Error(
      "[YouTubeCreatorMigration] Missing primary entry create-wedge-new-video-full — inventory corrupt",
    );
  }
  return entry;
}

/** Phase 0 complete when inventory is present and current phase marker is 0. */
export function isYouTubeCreatorMigrationPhase0Complete(): boolean {
  return YOUTUBE_CREATOR_MODAL_MIGRATION_PHASE === 0;
}
