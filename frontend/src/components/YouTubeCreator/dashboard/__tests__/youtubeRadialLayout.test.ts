import {
  computeYouTubeRadialLayout,
  layoutHubCenterPercent,
  youtubeHubCenterLeftCss,
  youtubeHubCenterYPx,
} from "../youtubeRadialLayout";

describe("youtubeRadialLayout hub axis", () => {
  it("places hub axis slightly right of column center on desktop (LinkedIn parity)", () => {
    const layout = computeYouTubeRadialLayout(800, {
      maxHeight: 640,
      desktopViewport: true,
    });
    expect(layout.centerX).toBeGreaterThan(400);
    expect(layout.centerX).toBeLessThan(520);
    expect(layoutHubCenterPercent(layout)).toBeCloseTo(58, 0);
    expect(youtubeHubCenterLeftCss(layout)).toMatch(/^5[78](\.\d+)?%$/);
    expect(youtubeHubCenterYPx(layout)).toBe(layout.centerY - layout.viewBoxY);
  });

  it("uses hub radius aligned with LinkedIn Studio", () => {
    const layout = computeYouTubeRadialLayout(800, {
      maxHeight: 640,
      desktopViewport: true,
    });
    expect(layout.hubVisualR).toBe(83);
  });
});
