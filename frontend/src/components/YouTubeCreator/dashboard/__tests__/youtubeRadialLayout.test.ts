import {
  computeYouTubeRadialLayout,
  layoutHubCenterPercent,
  youtubeHubCenterLeftCss,
  youtubeHubCenterYPx,
} from "../youtubeRadialLayout";

describe("youtubeRadialLayout hub axis", () => {
  it("places hub axis slightly left of column center on desktop", () => {
    const layout = computeYouTubeRadialLayout(800, {
      maxHeight: 640,
      desktopViewport: true,
    });
    expect(layout.centerX).toBeLessThan(400);
    expect(layout.centerX).toBeGreaterThan(320);
    expect(layoutHubCenterPercent(layout)).toBeCloseTo(45, 0);
    expect(youtubeHubCenterLeftCss(layout)).toMatch(/^4[45](\.\d+)?%$/);
    expect(youtubeHubCenterYPx(layout)).toBe(layout.centerY - layout.viewBoxY);
  });

  it("uses a smaller hub radius aligned with LinkedIn Studio", () => {
    const layout = computeYouTubeRadialLayout(800, {
      maxHeight: 640,
      desktopViewport: true,
    });
    expect(layout.hubVisualR).toBe(83);
  });
});
