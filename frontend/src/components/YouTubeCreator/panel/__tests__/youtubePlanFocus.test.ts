import {
  consumeYouTubePlanFocus,
  queueYouTubePlanFocus,
} from "../youtubePlanFocus";

describe("youtubePlanFocus", () => {
  it("queues and consumes brainstorm and saved-ideas focus once", () => {
    queueYouTubePlanFocus({ brainstorm: true });
    queueYouTubePlanFocus({ savedIdeas: true });
    expect(consumeYouTubePlanFocus()).toEqual({
      brainstorm: true,
      savedIdeas: true,
    });
    expect(consumeYouTubePlanFocus()).toBeNull();
  });
});
