import {
  youtubeWedgeHeaderTextGap,
  youtubeWedgeIconHeaderGap,
  youtubeWedgeLabelBoxWidth,
} from "../youtubeRadialWedgeUi";

describe("youtubeRadialWedgeUi", () => {
  it("matches LinkedIn wedge label spacing ratios", () => {
    expect(youtubeWedgeIconHeaderGap(20)).toBe(5);
    expect(youtubeWedgeHeaderTextGap(10)).toBe(6);
    expect(youtubeWedgeLabelBoxWidth("plan", 200)).toBe(196);
  });
});
