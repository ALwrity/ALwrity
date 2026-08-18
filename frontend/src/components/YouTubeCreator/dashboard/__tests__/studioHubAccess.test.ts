import {
  CONNECT_GATED_WORKFLOW_IDS,
  STUDIO_HUB_UNLOCK_ALL_FOR_TESTING,
  arePlanComingSoonTilesLocked,
  isStudioHubTestingUnlockEnabled,
  isTileConnectGated,
  isWedgeConnectGated,
} from "../studioHubAccessConfig";
import {
  resolveWedgeNavigation,
  shouldBlockWedgeNavigation,
} from "../studioHubWedgeNavigation";
import { resolveOAuthTileClick } from "../studioHubTileActions";

describe("studioHubAccessConfig", () => {
  it("enables testing unlock by default", () => {
    expect(STUDIO_HUB_UNLOCK_ALL_FOR_TESTING).toBe(true);
    expect(isStudioHubTestingUnlockEnabled()).toBe(true);
  });

  it("exposes no connect-gated wedges while testing unlock is on", () => {
    expect(CONNECT_GATED_WORKFLOW_IDS).toEqual([]);
  });

  it("does not gate wedges or tiles when testing unlock is on", () => {
    expect(isWedgeConnectGated("analysis", false)).toBe(false);
    expect(isTileConnectGated(false)).toBe(false);
    expect(arePlanComingSoonTilesLocked()).toBe(false);
  });
});

describe("studioHubWedgeNavigation", () => {
  it("opens wedges without connect gate while testing unlock is on", () => {
    const onOpenWedge = jest.fn();
    const onConnectGate = jest.fn();

    resolveWedgeNavigation("analysis", false, onOpenWedge, onConnectGate);

    expect(shouldBlockWedgeNavigation("analysis", false)).toBe(false);
    expect(onOpenWedge).toHaveBeenCalledWith("analysis");
    expect(onConnectGate).not.toHaveBeenCalled();
  });
});

describe("studioHubTileActions", () => {
  it("runs tile actions without connect while testing unlock is on", () => {
    const onAction = jest.fn();
    const onRequestConnect = jest.fn();
    const infoSpy = jest.spyOn(console, "info").mockImplementation(() => {});

    resolveOAuthTileClick(false, "channel_pulse", onAction, onRequestConnect);

    expect(onAction).toHaveBeenCalled();
    expect(onRequestConnect).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledWith(
      "[StudioHub] Opening OAuth-backed sub-modal while disconnected",
      expect.objectContaining({ action: "channel_pulse", testingUnlock: true }),
    );

    infoSpy.mockRestore();
  });
});
