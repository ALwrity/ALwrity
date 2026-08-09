import {
  CONVERSATIONS_TO_JOIN_TILE,
  ENGAGEMENT_WEDGE_MODAL_INTRO,
  ENGAGEMENT_WEDGE_RING_DESCRIPTION,
  GROWTH_ENGINE_ENGAGEMENT_TILE,
} from "../components/dashboard/engagementWedgeCopy";
import { DASHBOARD_WORKFLOW_CARDS } from "../components/dashboard/dashboardWorkflowConfig";

describe("engagementWedgeCopy", () => {
  it("exports thought-leader positioning strings", () => {
    expect(ENGAGEMENT_WEDGE_RING_DESCRIPTION).toMatch(/authority-building/i);
    expect(ENGAGEMENT_WEDGE_MODAL_INTRO).toMatch(/thought-leader/i);
  });

  it("renames opportunities tile to Conversations to Join", () => {
    expect(CONVERSATIONS_TO_JOIN_TILE.title).toBe("Conversations to Join");
  });

  it("frames Growth Engine as weekly capstone", () => {
    expect(GROWTH_ENGINE_ENGAGEMENT_TILE.description).toMatch(
      /Weekly strategy/i,
    );
  });

  it("wires ring description into dashboard workflow config", () => {
    const engagement = DASHBOARD_WORKFLOW_CARDS.find((c) => c.id === "engagement");
    expect(engagement?.description).toBe(ENGAGEMENT_WEDGE_RING_DESCRIPTION);
  });
});
