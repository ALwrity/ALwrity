import {
  YOUTUBE_CREATOR_AVOID_INFLATING,
  YOUTUBE_CREATOR_ENTRY_POINTS,
  YOUTUBE_CREATOR_MIGRATION_GUARDRAILS,
  YOUTUBE_CREATOR_MIGRATION_PLANNED_FILES,
  YOUTUBE_CREATOR_MIGRATION_TESTS,
  YOUTUBE_CREATOR_MODAL_MIGRATION_PHASE,
  YOUTUBE_CREATOR_MUST_REUSE,
  getYouTubeCreatorEntriesForPhase,
  getYouTubeCreatorPrimaryCreateEntry,
  isYouTubeCreatorMigrationPhase0Complete,
} from "./youtubeCreatorModalMigration.inventory";

describe("YouTube Creator modal migration — Phase 0 inventory", () => {
  it("marks Phase 0 as the active migration phase (no UX change yet)", () => {
    expect(YOUTUBE_CREATOR_MODAL_MIGRATION_PHASE).toBe(0);
    expect(isYouTubeCreatorMigrationPhase0Complete()).toBe(true);
  });

  it("locks product guardrails for Full Creator modal cutover", () => {
    expect(YOUTUBE_CREATOR_MIGRATION_GUARDRAILS).toEqual({
      singlePanelMount: true,
      noBackendChanges: true,
      reuseExistingPanel: true,
      primaryCreateTile: "New Video (Full)",
      closeReturnsToHub: true,
      directRouteAlwaysHub: true,
    });
  });

  it("requires reusing the existing panel and API stack (no duplication)", () => {
    expect(YOUTUBE_CREATOR_MUST_REUSE).toEqual(
      expect.arrayContaining([
        "YouTubeVideoCreatorPanel",
        "useYouTubeCreatorState",
        "youtubeApi",
        "YouTubeActionModal",
      ]),
    );
    expect(YOUTUBE_CREATOR_MIGRATION_PLANNED_FILES.neverDuplicate).toEqual(
      expect.arrayContaining([
        "YouTubeVideoCreatorPanel.tsx",
        "services/youtubeApi.ts",
        "backend/api/youtube/*",
      ]),
    );
    expect(YOUTUBE_CREATOR_AVOID_INFLATING.length).toBeGreaterThan(0);
  });

  it("documents New Video (Full) as the Phase 1 primary Create-wedge entry", () => {
    const primary = getYouTubeCreatorPrimaryCreateEntry();
    expect(primary.label).toBe("New Video (Full)");
    expect(primary.retargetInPhase).toBe(1);
    expect(primary.mechanism).toBe("goCreate");
    expect(primary.detailSummary).toContain("medium");
  });

  it("has unique entry point ids and covers migration phases 1–4", () => {
    const ids = YOUTUBE_CREATOR_ENTRY_POINTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(YOUTUBE_CREATOR_ENTRY_POINTS.length).toBeGreaterThanOrEqual(20);

    expect(getYouTubeCreatorEntriesForPhase(1).length).toBe(1);
    expect(getYouTubeCreatorEntriesForPhase(2).length).toBeGreaterThan(10);
    expect(getYouTubeCreatorEntriesForPhase(3).length).toBeGreaterThanOrEqual(3);
    expect(getYouTubeCreatorEntriesForPhase(4).some((e) => e.mechanism === "shell_tab")).toBe(
      true,
    );
  });

  it("lists Shorts, Title Lab, Script Coach, and Resume Draft for same-modal retarget (Phase 2)", () => {
    const phase2Labels = getYouTubeCreatorEntriesForPhase(2).map((e) => e.label);
    expect(phase2Labels).toEqual(
      expect.arrayContaining([
        "Shorts Fast Path",
        "Title & Hook Lab",
        "Script / Scene Coach",
        "Resume Draft",
      ]),
    );
  });

  it("plans a thin modal host in Phase 1 and no backend file creates", () => {
    expect(YOUTUBE_CREATOR_MIGRATION_PLANNED_FILES.create).toEqual([
      expect.objectContaining({
        path: "dashboard/modals/YouTubeVideoCreatorModal.tsx",
        phase: 1,
      }),
    ]);
    const backendCreates = YOUTUBE_CREATOR_MIGRATION_PLANNED_FILES.create.filter((f) =>
      f.path.includes("backend"),
    );
    expect(backendCreates).toHaveLength(0);
  });

  it("tracks existing tests that later phases must update", () => {
    expect(YOUTUBE_CREATOR_MIGRATION_TESTS.length).toBeGreaterThanOrEqual(3);
    expect(YOUTUBE_CREATOR_MIGRATION_TESTS.map((t) => t.file)).toEqual(
      expect.arrayContaining(["dashboard/youtubeStudioEvents.test.ts"]),
    );
  });
});
