/**
 * Full Creator modal migration inventory (complete).
 *
 * Historical checklist of every entry into Video Creator. Retarget work landed in
 * PRs 1–6; this module documents the final contract so we do not regress.
 *
 * Product contract (locked):
 * - All Video Creator features stay in existing YouTubeVideoCreatorPanel.
 * - Primary Create-wedge entry: "New Video (Full)".
 * - Shorts / Title Lab / Script Coach / Resume Draft open the SAME modal.
 * - Close modal → Studio Hub. `/youtube-creator` → always Hub.
 * - Panel mounts only inside YouTubeVideoCreatorModal (no shell tab).
 * - No new backend routes or duplicated youtube API layers.
 */

export const YOUTUBE_CREATOR_MODAL_MIGRATION_PHASE = 7 as const;

export type YouTubeCreatorMigrationPhase = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** How the pipeline is reached after Hub-only cutover. */
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
  /** Prefill / open detail used after cutover. */
  detailSummary: string;
  /**
   * PR phase that retargeted this entry to the Full Creator modal
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
  /** Direct /youtube-creator is Hub-only. */
  directRouteAlwaysHub: true;
  /** Sole mount host for YouTubeVideoCreatorPanel. */
  panelMountHost: "YouTubeVideoCreatorModal";
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
 * Every known path into Video Creator after Hub-only + Full Creator modal cutover.
 */
export const YOUTUBE_CREATOR_ENTRY_POINTS: readonly YouTubeCreatorEntryPoint[] = [
  {
    id: "create-wedge-new-video-full",
    label: "New Video (Full)",
    sourceFile: "dashboard/modals/CreateWedgeModal.tsx",
    mechanism: "goCreate",
    detailSummary: "{ step: 0, durationType: 'medium' } — Full Creator modal via openYouTubeCreator",
    retargetInPhase: 1,
  },
  {
    id: "create-wedge-shorts",
    label: "Shorts Fast Path",
    sourceFile: "dashboard/modals/CreateWedgeModal.tsx",
    mechanism: "goCreate",
    detailSummary: "{ step: 0, durationType: 'shorts' } — same Full Creator modal",
    retargetInPhase: 2,
  },
  {
    id: "create-wedge-title-hook",
    label: "Title & Hook Lab",
    sourceFile: "dashboard/modals/CreateWedgeModal.tsx",
    mechanism: "goCreate",
    detailSummary: "{ step: creatorState.videoPlan ? 1 : 0 } — same Full Creator modal",
    retargetInPhase: 2,
  },
  {
    id: "create-wedge-script-coach",
    label: "Script / Scene Coach",
    sourceFile: "dashboard/modals/CreateWedgeModal.tsx",
    mechanism: "goCreate",
    detailSummary: "{ step: scenes.length > 0 ? 1 : 0 } — same Full Creator modal",
    retargetInPhase: 2,
  },
  {
    id: "hub-connect-create-video",
    label: "Hub connect / Create video CTA",
    sourceFile: "dashboard/YouTubeStudioHub.tsx",
    mechanism: "openYouTubeCreator",
    detailSummary: "{ step: 0 } — Full Creator modal on Hub",
    retargetInPhase: 2,
  },
  {
    id: "hub-start-new-video",
    label: "Start New Video (hub)",
    sourceFile: "dashboard/YouTubeStudioHub.tsx",
    mechanism: "openYouTubeCreator",
    detailSummary: "clear draft then { step: 0 } — Full Creator modal",
    retargetInPhase: 2,
  },
  {
    id: "hub-resume-draft",
    label: "Resume Draft",
    sourceFile: "dashboard/YouTubeResumeDraftChip.tsx",
    mechanism: "resumeYouTubeDraft",
    detailSummary: "openYouTubeCreator({ step from youtube_creator_state }) — no tab switch",
    retargetInPhase: 2,
  },
  {
    id: "knowledge-center-create",
    label: "Knowledge Center → create",
    sourceFile: "dashboard/YouTubeKnowledgeCenter.tsx",
    mechanism: "openYouTubeCreator",
    detailSummary: "{ step: 0 } — Full Creator modal",
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
    detailSummary: "{ step: 3 } — Full Creator modal",
    retargetInPhase: 2,
  },
  {
    id: "plan-wedge-idea-workspace",
    label: "Plan wedge idea → Creator",
    sourceFile: "dashboard/modals/YouTubePlanIdeaWorkspace.tsx",
    mechanism: "goCreate",
    detailSummary: "{ step: 0, userIdea: prompt } — Full Creator modal",
    retargetInPhase: 2,
  },
  {
    id: "plan-wedge-sidebar-tools",
    label: "Plan sidebar tools → Creator",
    sourceFile: "dashboard/modals/YouTubePlanSidebarTools.tsx",
    mechanism: "goCreate",
    detailSummary: "{ step: 0 } — Full Creator modal",
    retargetInPhase: 2,
  },
  {
    id: "publish-wedge-continue",
    label: "Publish wedge → continue / render",
    sourceFile: "dashboard/modals/PublishWedgeModal.tsx",
    mechanism: "goCreate",
    detailSummary: "activeStep or { step: 3 } — Full Creator modal",
    retargetInPhase: 2,
  },
  {
    id: "engagement-wedge-create",
    label: "Engagement wedge → Creator",
    sourceFile: "dashboard/modals/EngagementWedgeModal.tsx",
    mechanism: "goCreate",
    detailSummary: "{ step: videoPlan ? 1 : 0 } — Full Creator modal",
    retargetInPhase: 2,
  },
  {
    id: "remarket-winner-shorts",
    label: "Remarket → Winner Shorts",
    sourceFile: "dashboard/modals/RemarketWedgeModal.tsx",
    mechanism: "goCreate",
    detailSummary: "{ step: 0, durationType: 'shorts', userIdea } — Full Creator modal",
    retargetInPhase: 2,
  },
  {
    id: "remarket-perf-plan",
    label: "Remarket → Perf Plan",
    sourceFile: "dashboard/modals/RemarketWedgeModal.tsx",
    mechanism: "goCreate",
    detailSummary: "{ step: 0, userIdea from plan/title } — Full Creator modal",
    retargetInPhase: 2,
  },
  {
    id: "remarket-next-idea",
    label: "Remarket → next idea",
    sourceFile: "dashboard/modals/RemarketWedgeModal.tsx",
    mechanism: "goCreate",
    detailSummary: "{ step: 0, userIdea: nextIdea } — Full Creator modal",
    retargetInPhase: 2,
  },
  {
    id: "helper-coach-improve",
    label: "Pre-publish coach → Improve in Creator",
    sourceFile: "dashboard/modals/WorkflowHelperModals.tsx",
    mechanism: "goCreate",
    detailSummary: "{ step: videoPlan ? 1 : 0 } — Full Creator modal",
    retargetInPhase: 2,
  },
  {
    id: "helper-seo-edit",
    label: "SEO Pack helper → Creator",
    sourceFile: "dashboard/modals/WorkflowHelperModals.tsx",
    mechanism: "goCreate",
    detailSummary: "step 1 (or related plan step) — Full Creator modal",
    retargetInPhase: 2,
  },
  {
    id: "helper-thumb-related",
    label: "Thumbnail / related helper → Creator",
    sourceFile: "dashboard/modals/WorkflowHelperModals.tsx",
    mechanism: "goCreate",
    detailSummary: "step 0 / 2 depending on tile — Full Creator modal",
    retargetInPhase: 2,
  },
  {
    id: "workflow-goCreate-hub",
    label: "YouTubeWorkflowModals.goCreate",
    sourceFile: "dashboard/YouTubeWorkflowModals.tsx",
    mechanism: "openYouTubeCreator",
    detailSummary: "closes active wedge then openYouTubeCreator(detail) — Hub modal host",
    retargetInPhase: 2,
  },
  {
    id: "blog-create-youtube-video",
    label: "Blog Publish → Create YouTube video",
    sourceFile: "BlogWriter/BlogWriterUtils/PublishContent.tsx",
    mechanism: "queueYouTubeCreatorOpen+navigate",
    detailSummary: "queue { step: 0, userIdea, focusUrlImport } + navigate('/youtube-creator')",
    retargetInPhase: 3,
  },
  {
    id: "dashboard-pillar-youtube",
    label: "MainDashboard GeneratePillarChips → YouTube",
    sourceFile: "MainDashboard/components/GeneratePillarChips.tsx",
    mechanism: "navigate_only",
    detailSummary: "navigate('/youtube-creator') — Hub landing",
    retargetInPhase: 3,
  },
  {
    id: "oauth-callback-redirect",
    label: "YouTube OAuth callback",
    sourceFile: "YouTubeCreator/YouTubeCallbackPage.tsx",
    mechanism: "navigate_only",
    detailSummary: "replace('/youtube-creator') — Hub landing",
    retargetInPhase: 3,
  },
  {
    id: "demo-landing-youtube",
    label: "demoMode youtube landing",
    sourceFile: "utils/demoMode.ts",
    mechanism: "navigate_only",
    detailSummary: "feature youtube → /youtube-creator — Hub landing",
    retargetInPhase: 3,
  },
  {
    id: "shell-video-creator-tab",
    label: "Video Creator tab (shell)",
    sourceFile: "YouTubeCreator/YouTubeCreator.tsx",
    mechanism: "shell_tab",
    detailSummary: "Removed — Hub-only shell; panel only in YouTubeVideoCreatorModal",
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
  panelMountHost: "YouTubeVideoCreatorModal",
};

/** Regression tests that lock Hub-only + Full Creator modal behavior. */
export const YOUTUBE_CREATOR_MIGRATION_TESTS = [
  {
    file: "dashboard/youtubeStudioEvents.test.ts",
    notes: "parseYouTubeStudioTab always hub; openYouTubeCreator does not switchTab(creator)",
    touchInPhase: 3 as YouTubeCreatorMigrationPhase,
  },
  {
    file: "dashboard/__tests__/useYouTubeStudioTab.test.tsx",
    notes: "Hub-only; setTab(creator) opens Full Creator modal",
    touchInPhase: 4 as YouTubeCreatorMigrationPhase,
  },
  {
    file: "dashboard/__tests__/useYouTubeCreatorLandingDeepLink.test.tsx",
    notes: "Legacy ?tab=creator queues Full Creator open",
    touchInPhase: 3 as YouTubeCreatorMigrationPhase,
  },
  {
    file: "dashboard/__tests__/useYouTubeFullCreatorModalHost.test.ts",
    notes: "Event + pending deep-link open Full Creator modal",
    touchInPhase: 2 as YouTubeCreatorMigrationPhase,
  },
  {
    file: "dashboard/__tests__/CreateWedgeModal.test.tsx",
    notes: "Create wedge tiles call goCreate → modal path",
    touchInPhase: 1 as YouTubeCreatorMigrationPhase,
  },
  {
    file: "dashboard/__tests__/YouTubeVideoCreatorModal.test.tsx",
    notes: "Thin modal hosts YouTubeVideoCreatorPanel",
    touchInPhase: 1 as YouTubeCreatorMigrationPhase,
  },
  {
    file: "utils/__tests__/demoMode.pricing.test.ts",
    notes: "expects /youtube-creator landing (Hub route unchanged)",
    touchInPhase: 3 as YouTubeCreatorMigrationPhase,
  },
] as const;

/** Files landed for the migration (historical map; do not re-open tab shell). */
export const YOUTUBE_CREATOR_MIGRATION_LANDED_FILES = {
  create: [
    {
      path: "dashboard/modals/YouTubeVideoCreatorModal.tsx",
      reason: "Thin Full Creator modal host wrapping existing YouTubeVideoCreatorPanel",
      phase: 1 as YouTubeCreatorMigrationPhase,
    },
    {
      path: "dashboard/useYouTubeFullCreatorModalHost.ts",
      reason: "Hub listens for openYouTubeCreator / pending deep-link",
      phase: 1 as YouTubeCreatorMigrationPhase,
    },
    {
      path: "dashboard/useYouTubeCreatorLandingDeepLink.ts",
      reason: "Legacy ?tab=creator → Hub + queue Full Creator",
      phase: 3 as YouTubeCreatorMigrationPhase,
    },
  ],
  modify: [
    {
      path: "dashboard/modals/CreateWedgeModal.tsx",
      reason: "New Video (Full) and sibling tiles use goCreate → modal",
      phase: 1 as YouTubeCreatorMigrationPhase,
    },
    {
      path: "dashboard/YouTubeWorkflowModals.tsx",
      reason: "Hosts Full Creator modal; goCreate closes wedge then opens modal",
      phase: 1 as YouTubeCreatorMigrationPhase,
    },
    {
      path: "dashboard/youtubeStudioEvents.ts",
      reason: "openYouTubeCreator / resume without switchTab(creator)",
      phase: 2 as YouTubeCreatorMigrationPhase,
    },
    {
      path: "dashboard/useYouTubeStudioTab.ts",
      reason: "Hub-only; creator switch maps to Full Creator modal",
      phase: 3 as YouTubeCreatorMigrationPhase,
    },
    {
      path: "BlogWriter/BlogWriterUtils/PublishContent.tsx",
      reason: "Deep-link via pending queue + /youtube-creator (no ?tab=creator)",
      phase: 3 as YouTubeCreatorMigrationPhase,
    },
    {
      path: "YouTubeCreator.tsx",
      reason: "Hub-only shell; Video Creator tab removed",
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

/** @deprecated Prefer YOUTUBE_CREATOR_MIGRATION_LANDED_FILES (migration complete). */
export const YOUTUBE_CREATOR_MIGRATION_PLANNED_FILES = YOUTUBE_CREATOR_MIGRATION_LANDED_FILES;

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

/** Migration complete when phase marker is 7 (harden / docs). */
export function isYouTubeCreatorMigrationComplete(): boolean {
  return YOUTUBE_CREATOR_MODAL_MIGRATION_PHASE === 7;
}

/** @deprecated Use isYouTubeCreatorMigrationComplete — Phase 0 inventory only. */
export function isYouTubeCreatorMigrationPhase0Complete(): boolean {
  return YOUTUBE_CREATOR_MODAL_MIGRATION_PHASE === 0;
}
