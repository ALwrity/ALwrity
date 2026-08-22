import {
  consumeYouTubePlanDrillDown,
  peekYouTubePlanDrillDown,
  queueYouTubePlanDrillDown,
} from "./youtubePlanDrillDown";

describe("youtubePlanDrillDown", () => {
  beforeEach(() => {
    sessionStorage.clear();
    consumeYouTubePlanDrillDown();
  });

  it("queues and consumes drill-down detail", () => {
    queueYouTubePlanDrillDown({ sub: "url-import", seed: "Bali travel" });

    expect(peekYouTubePlanDrillDown()).toEqual({
      sub: "url-import",
      seed: "Bali travel",
    });

    expect(consumeYouTubePlanDrillDown()).toEqual({
      sub: "url-import",
      seed: "Bali travel",
    });
    expect(consumeYouTubePlanDrillDown()).toBeNull();
  });

  it("restores from sessionStorage after reload simulation", () => {
    queueYouTubePlanDrillDown({ sub: "brainstorm", seed: "AI tips" });
    consumeYouTubePlanDrillDown();

    sessionStorage.setItem(
      "yt_pending_plan_drill_down",
      JSON.stringify({ sub: "saved-ideas", seed: "From blog" }),
    );

    expect(peekYouTubePlanDrillDown()).toEqual({
      sub: "saved-ideas",
      seed: "From blog",
    });
  });
});
