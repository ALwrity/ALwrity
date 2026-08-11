import {
  isPublishWedgeScheduleLocked,
  isPublishWedgeTimingLocked,
  PUBLISH_WEDGE_TIMING_LOCKED_HINT,
} from "../utils/linkedInPublishWedgeLockedUi";

describe("linkedInPublishWedgeLockedUi", () => {
  it("locks schedule and best-time features on the frontend", () => {
    expect(isPublishWedgeScheduleLocked()).toBe(true);
    expect(isPublishWedgeTimingLocked()).toBe(true);
  });

  it("provides a hint for locked Best Time", () => {
    expect(PUBLISH_WEDGE_TIMING_LOCKED_HINT).toMatch(/Best Time/i);
  });
});
