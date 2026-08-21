import {
  YOUTUBE_CREATOR_AVOID_INFLATING,
  YOUTUBE_CREATOR_ENTRY_POINTS,
  YOUTUBE_CREATOR_MIGRATION_GUARDRAILS,
  YOUTUBE_CREATOR_MIGRATION_LANDED_FILES,
  YOUTUBE_CREATOR_MIGRATION_TESTS,
  YOUTUBE_CREATOR_MODAL_MIGRATION_PHASE,
  YOUTUBE_CREATOR_MUST_REUSE,
  getYouTubeCreatorEntriesForPhase,
  getYouTubeCreatorPrimaryCreateEntry,
  isYouTubeCreatorMigrationComplete,
} from "./youtubeCreatorModalMigration.inventory";

describe("YouTube Creator modal migration — complete inventory", () => {
  it("marks migration complete at phase 7 (harden)", () => {
    expect(YOUTUBE_CREATOR_MODAL_MIGRATION_PHASE).toBe(7);
    expect(isYouTubeCreatorMigrationComplete()).toBe(true);
  });

  it("locks product guardrails for Hub-only + Full Creator modal", () => {
    expect(YOUTUBE_CREATOR_MIGRATION_GUARDRAILS).toEqual({
      singlePanelMount: true,
      noBackendChanges: true,
      reuseExistingPanel: true,
      primaryCreateTile: "New Video (Full)",
      closeReturnsToHub: true,
      directRouteAlwaysHub: true,
      panelMountHost: "YouTubeVideoCreatorModal",
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
    expect(YOUTUBE_CREATOR_MIGRATION_LANDED_FILES.neverDuplicate).toEqual(
      expect.arrayContaining([
        "YouTubeVideoCreatorPanel.tsx",
        "services/youtubeApi.ts",
        "backend/api/youtube/*",
      ]),
    );
    expect(YOUTUBE_CREATOR_AVOID_INFLATING.length).toBeGreaterThan(0);
  });

  it("documents New Video (Full) as the primary Create-wedge entry", () => {
    const primary = getYouTubeCreatorPrimaryCreateEntry();
    expect(primary.label).toBe("New Video (Full)");
    expect(primary.retargetInPhase).toBe(1);
    expect(primary.mechanism).toBe("goCreate");
    expect(primary.detailSummary).toContain("medium");
    expect(primary.detailSummary).toMatch(/Full Creator modal/i);
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

  it("records shell tab as removed (Hub-only)", () => {
    const shell = YOUTUBE_CREATOR_ENTRY_POINTS.find((e) => e.id === "shell-video-creator-tab");
    expect(shell?.detailSummary).toMatch(/Removed/i);
    expect(shell?.detailSummary).toMatch(/YouTubeVideoCreatorModal/);
  });

  it("lists Shorts, Title Lab, Script Coach, and Resume Draft on the same modal path", () => {
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

  it("lands a thin modal host and no backend file creates", () => {
    expect(YOUTUBE_CREATOR_MIGRATION_LANDED_FILES.create).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "dashboard/modals/YouTubeVideoCreatorModal.tsx",
          phase: 1,
        }),
      ]),
    );
    const backendCreates = YOUTUBE_CREATOR_MIGRATION_LANDED_FILES.create.filter((f) =>
      f.path.includes("backend"),
    );
    expect(backendCreates).toHaveLength(0);
  });

  it("tracks regression tests for Hub-only + modal behavior", () => {
    expect(YOUTUBE_CREATOR_MIGRATION_TESTS.length).toBeGreaterThanOrEqual(5);
    expect(YOUTUBE_CREATOR_MIGRATION_TESTS.map((t) => t.file)).toEqual(
      expect.arrayContaining([
        "dashboard/youtubeStudioEvents.test.ts",
        "dashboard/__tests__/useYouTubeStudioTab.test.tsx",
        "dashboard/__tests__/YouTubeVideoCreatorModal.test.tsx",
      ]),
    );
  });
});
