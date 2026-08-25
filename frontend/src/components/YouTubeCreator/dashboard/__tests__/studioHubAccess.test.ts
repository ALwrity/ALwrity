import {
  CONNECT_GATED_WORKFLOW_IDS,
  arePlanComingSoonTilesLocked,
  isTileConnectGated,
  isWedgeConnectGated,
} from "../studioHubAccessConfig";
import {
  resolveWedgeNavigation,
  shouldBlockWedgeNavigation,
} from "../studioHubWedgeNavigation";
import { resolveOAuthTileClick } from "../studioHubTileActions";

describe("studioHubAccessConfig", () => {
  it("keeps all hero wedges open on the landing page", () => {
    expect(CONNECT_GATED_WORKFLOW_IDS).toEqual([]);
    expect(isWedgeConnectGated("analysis", false)).toBe(false);
    expect(isWedgeConnectGated("engagement", false)).toBe(false);
    expect(isTileConnectGated(false)).toBe(false);
    expect(arePlanComingSoonTilesLocked()).toBe(false);
  });
});

describe("studioHubWedgeNavigation", () => {
  it("opens any wedge without a connect gate", () => {
    const onOpenWedge = jest.fn();
    const onConnectGate = jest.fn();

    resolveWedgeNavigation("analysis", false, onOpenWedge, onConnectGate);

    expect(shouldBlockWedgeNavigation("analysis", false)).toBe(false);
    expect(onOpenWedge).toHaveBeenCalledWith("analysis");
    expect(onConnectGate).not.toHaveBeenCalled();
  });
});

describe("studioHubTileActions", () => {
  it("runs tile actions without a hub-level connect gate", () => {
    const onAction = jest.fn();
    const onRequestConnect = jest.fn();

    resolveOAuthTileClick(false, "channel_pulse", onAction, onRequestConnect);

    expect(onAction).toHaveBeenCalled();
    expect(onRequestConnect).not.toHaveBeenCalled();
  });
});
