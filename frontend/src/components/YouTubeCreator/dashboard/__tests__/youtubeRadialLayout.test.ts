import {
  computeYouTubeRadialLayout,
  youtubeHubCenterLeftCss,
  youtubeHubCenterYPx,
} from "../youtubeRadialLayout";

describe("youtubeRadialLayout hub axis", () => {
  it("places hub and connect on the horizontal center of the canvas", () => {
    const layout = computeYouTubeRadialLayout(800, 640);
    expect(layout.centerX).toBe(400);
    expect(youtubeHubCenterLeftCss(layout)).toBe("50%");
    expect(youtubeHubCenterYPx(layout)).toBe(layout.centerY - layout.viewBoxY);
  });
});
