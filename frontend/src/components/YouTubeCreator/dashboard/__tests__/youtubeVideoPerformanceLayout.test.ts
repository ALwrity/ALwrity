/**
 * Video Performance split layout lives in youtubeVideoPerformanceLayout.css
 * so youtube-dashboard-layout.css is not grown past the golden-rule limit.
 */
import * as fs from "fs";
import * as path from "path";

const dashboardDir = path.join(__dirname, "..");
const layoutCssPath = path.join(dashboardDir, "youtube-dashboard-layout.css");
const performanceCssPath = path.join(
  dashboardDir,
  "youtubeVideoPerformanceLayout.css",
);

describe("YouTube Video Performance layout stylesheet", () => {
  it("keeps context/work split rules out of the hub layout sheet", () => {
    const hubCss = fs.readFileSync(layoutCssPath, "utf8");
    const performanceCss = fs.readFileSync(performanceCssPath, "utf8");

    expect(hubCss).not.toMatch(/yt-video-performance-list--split/);
    expect(hubCss).not.toMatch(/yt-video-performance-card--split/);
    expect(hubCss).not.toMatch(/yt-video-performance-card__context/);
    expect(hubCss).not.toMatch(/yt-video-performance-card__work/);

    expect(performanceCss).toMatch(/\.yt-video-performance-list--split/);
    expect(performanceCss).toMatch(/repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(performanceCss).toMatch(/\.yt-video-performance-card--split/);
    expect(performanceCss).toMatch(/\.yt-video-performance-card__context/);
    expect(performanceCss).toMatch(/\.yt-video-performance-card__work/);
    expect(performanceCss).toMatch(/minmax\(120px,\s*180px\)/);
    expect(performanceCss).toMatch(/@media \(max-width:\s*720px\)/);
  });

  it("styles the watch icon tooltip and hover zoom in the performance sheet", () => {
    const performanceCss = fs.readFileSync(performanceCssPath, "utf8");
    expect(performanceCss).toMatch(/\.yt-video-performance-card__open:hover/);
    expect(performanceCss).toMatch(/transform:\s*scale\(/);
    expect(performanceCss).toMatch(/attr\(data-tooltip\)/);
  });
});
