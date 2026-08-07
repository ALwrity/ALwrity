import {
  GROW_NETWORK_AI_SECTION,
  GROW_NETWORK_ENGINE_LINK,
  GROW_NETWORK_MODAL_TITLE,
  GROW_NETWORK_PYMK_SECTION,
  GROW_NETWORK_TILE,
} from "../components/dashboard/growNetworkConstants";

describe("growNetworkConstants", () => {
  it("defines unified modal title and tile", () => {
    expect(GROW_NETWORK_MODAL_TITLE).toBe("Grow Network");
    expect(GROW_NETWORK_TILE.title).toBe("Grow Network");
    expect(GROW_NETWORK_TILE.icon).toBeTruthy();
  });

  it("labels AI and LinkedIn sources distinctly", () => {
    expect(GROW_NETWORK_AI_SECTION.title).toBe("Network Advisor");
    expect(GROW_NETWORK_AI_SECTION.sourceLabel).toBe("Grounded AI");
    expect(GROW_NETWORK_PYMK_SECTION.sourceLabel).toBe("Live LinkedIn");
    expect(GROW_NETWORK_AI_SECTION.sourceLabel).not.toBe(
      GROW_NETWORK_PYMK_SECTION.sourceLabel,
    );
  });

  it("defines Growth Engine teaser copy for P5 dedup", () => {
    expect(GROW_NETWORK_ENGINE_LINK.title).toBe("Grow Network");
    expect(GROW_NETWORK_ENGINE_LINK.cta).toContain("Grow Network");
  });
});
