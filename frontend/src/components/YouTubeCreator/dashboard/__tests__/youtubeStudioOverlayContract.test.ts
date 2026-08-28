import {
  MUI_DEFAULT_MODAL_Z_INDEX,
  MUI_DEFAULT_TOOLTIP_Z_INDEX,
  YOUTUBE_STUDIO_OVERLAY_CONTRACT_PHASE,
  YOUTUBE_STUDIO_OVERLAY_FORBIDDEN,
  YOUTUBE_STUDIO_OVERLAY_TIER_OWNERS,
  YOUTUBE_STUDIO_OVERLAY_TIERS,
  YT_Z_CREATOR_SURFACE,
  YT_Z_KNOWLEDGE_CENTER,
  YT_Z_MOBILE_FAB,
  YT_Z_MODAL,
  YT_Z_MODAL_POPOVER,
  YT_Z_RAIL,
} from "../youtubeStudioZIndex";
import {
  getYouTubeOverlayMigrationChecklist,
  getYouTubeOverlaysByKind,
  getYouTubeOverlaysNestedUnderFullCreator,
  YOUTUBE_STUDIO_OVERLAY_INVENTORY,
} from "../youtubeStudioOverlayInventory";
import { selectMenuProps, tooltipPopperProps } from "../../styles";

describe("YouTube Studio overlay contract (Phase 5 quality gates)", () => {
  it("is Phase 5 (layering tests and z-index guardrails)", () => {
    expect(YOUTUBE_STUDIO_OVERLAY_CONTRACT_PHASE).toBe(5);
  });

  it("keeps Hub wedge z-index numbers frozen", () => {
    expect(YT_Z_RAIL).toBe(24);
    expect(YT_Z_MOBILE_FAB).toBe(1200);
    expect(YT_Z_KNOWLEDGE_CENTER).toBe(12000);
    expect(YT_Z_MODAL).toBe(13000);
    expect(YT_Z_MODAL_POPOVER).toBe(13001);
    expect(YOUTUBE_STUDIO_OVERLAY_TIERS.studioModal).toBe(YT_Z_MODAL);
    expect(YOUTUBE_STUDIO_OVERLAY_TIERS.studioModalNestedPopper).toBe(YT_Z_MODAL_POPOVER);
  });

  it("keeps Hub modal above rail and Knowledge Centre; retired popper stays above modal", () => {
    expect(YT_Z_MODAL).toBeGreaterThan(YT_Z_RAIL);
    expect(YT_Z_MODAL).toBeGreaterThan(YT_Z_KNOWLEDGE_CENTER);
    expect(YT_Z_MODAL_POPOVER).toBeGreaterThan(YT_Z_MODAL);
    expect(YT_Z_MODAL).toBeGreaterThan(MUI_DEFAULT_MODAL_Z_INDEX);
  });

  it("places Full Creator surface below MUI modal so nested dialogs stack natively", () => {
    expect(YT_Z_CREATOR_SURFACE).toBe(1250);
    expect(YT_Z_CREATOR_SURFACE).toBeLessThan(MUI_DEFAULT_MODAL_Z_INDEX);
    expect(YT_Z_CREATOR_SURFACE).toBeLessThan(YT_Z_MODAL);
    expect(YT_Z_CREATOR_SURFACE).toBeGreaterThan(YT_Z_RAIL);
    expect(YOUTUBE_STUDIO_OVERLAY_TIERS.creatorSurface).toBe(YT_Z_CREATOR_SURFACE);
  });

  it("assigns an owner to every approved tier", () => {
    expect(Object.keys(YOUTUBE_STUDIO_OVERLAY_TIER_OWNERS).sort()).toEqual(
      Object.keys(YOUTUBE_STUDIO_OVERLAY_TIERS).sort(),
    );
  });

  it("forbids new z-index arms-race patches", () => {
    expect([...YOUTUBE_STUDIO_OVERLAY_FORBIDDEN]).toEqual([
      "New z-index literals in YouTube Creator feature files",
      "New YT_Z_MODAL + n workarounds for nested Dialog/Select/Tooltip/Confirm",
      "Raising YT_Z_MODAL to win overlay races",
      "App-wide MUI zIndex.modal / snackbar / tooltip overrides",
      "disablePortal nested dialogs into .yt-modal-card",
      "Additional multi-step pipelines inside YouTubeActionModal",
    ]);
  });

  it("does not apply +1 z-index patches on Plan Select or Tooltip", () => {
    expect((selectMenuProps as any).style?.zIndex).toBeUndefined();
    expect((selectMenuProps as any).sx?.zIndex).toBeUndefined();
    expect(selectMenuProps.PaperProps?.sx).not.toEqual(
      expect.objectContaining({ zIndex: YT_Z_MODAL_POPOVER }),
    );
    expect(tooltipPopperProps).toEqual({});
  });

  it("keeps MUI tooltip above MUI modal for creator-flow help", () => {
    expect(MUI_DEFAULT_TOOLTIP_Z_INDEX).toBeGreaterThan(MUI_DEFAULT_MODAL_Z_INDEX);
    expect(YT_Z_CREATOR_SURFACE).toBeLessThan(MUI_DEFAULT_MODAL_Z_INDEX);
    expect(YT_Z_CREATOR_SURFACE).toBeLessThan(MUI_DEFAULT_TOOLTIP_Z_INDEX);
  });
});

describe("YouTube Studio overlay inventory", () => {
  it("has unique overlay ids", () => {
    const ids = YOUTUBE_STUDIO_OVERLAY_INVENTORY.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("classifies custom createPortal hosts", () => {
    const custom = getYouTubeOverlaysByKind("custom_createPortal").map((entry) => entry.component);
    expect(custom).toEqual(
      expect.arrayContaining([
        "YouTubeActionModal",
        "YouTubeVideoCreatorModal",
        "YouTubeKnowledgeCenter",
      ]),
    );
  });

  it("records nested Full Creator overlays as MUI-native after Phase 3", () => {
    const nestedIds = getYouTubeOverlaysNestedUnderFullCreator().map((entry) => entry.id);
    expect(nestedIds).toEqual(
      expect.arrayContaining([
        "scene-image-settings",
        "scene-audio-settings",
        "scene-preview",
        "start-new-video-confirm",
        "plan-select-menus",
      ]),
    );
    const image = YOUTUBE_STUDIO_OVERLAY_INVENTORY.find((entry) => entry.id === "scene-image-settings");
    expect(image?.migrationAction).toBe("mui_native_restored");
    expect(image?.zIndexSource).toMatch(/MUI Dialog default/);
    const menus = YOUTUBE_STUDIO_OVERLAY_INVENTORY.find((entry) => entry.id === "plan-select-menus");
    expect(menus?.migrationAction).toBe("mui_native_restored");
    expect(menus?.zIndexSource).not.toMatch(/13001/);
    const confirm = YOUTUBE_STUDIO_OVERLAY_INVENTORY.find((entry) => entry.id === "start-new-video-confirm");
    expect(confirm?.migrationAction).toBe("mui_native_restored");
    expect(confirm?.zIndexSource).not.toMatch(/13000/);
  });

  it("marks Full Creator host as a dedicated surface (not YT_Z_MODAL)", () => {
    const host = YOUTUBE_STUDIO_OVERLAY_INVENTORY.find((entry) => entry.id === "full-creator-host");
    expect(host?.migrationAction).toBe("full_creator_surface_landed");
    expect(host?.zIndexSource).toMatch(/YT_Z_CREATOR_SURFACE/);
    expect(host?.zIndexSource).not.toMatch(/YT_Z_MODAL/);
    const checklist = getYouTubeOverlayMigrationChecklist();
    expect(checklist.find((item) => item.id === "full-creator-host")?.blockedUntilPhase).toBe("none");
    expect(checklist.find((item) => item.id === "plan-wedge")?.blockedUntilPhase).toBe("none");
    expect(checklist.find((item) => item.id === "scene-image-settings")?.blockedUntilPhase).toBe("none");
    expect(checklist.find((item) => item.id === "plan-select-menus")?.blockedUntilPhase).toBe("none");
    expect(checklist.find((item) => item.id === "start-new-video-confirm")?.blockedUntilPhase).toBe("none");
    expect(checklist.find((item) => item.id === "css-hub-isolation")?.blockedUntilPhase).toBe("none");
    expect(checklist.find((item) => item.id === "css-modal-backdrop-duplicate")?.blockedUntilPhase).toBe(
      "none",
    );
    expect(checklist.find((item) => item.id === "css-hub-toolbar")?.blockedUntilPhase).toBe("none");
    expect(YOUTUBE_STUDIO_OVERLAY_INVENTORY.find((entry) => entry.id === "css-hub-isolation")?.migrationAction).toBe(
      "isolation_removed",
    );
  });
});
