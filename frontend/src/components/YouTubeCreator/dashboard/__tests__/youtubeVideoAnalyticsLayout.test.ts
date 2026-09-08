/**
 * Video Analytics chrome styles stay in youtubeVideoAnalyticsLayout.css.
 */
import * as fs from "fs";
import * as path from "path";

const dashboardDir = path.join(__dirname, "..");
const hubCss = fs.readFileSync(
  path.join(dashboardDir, "youtube-dashboard-layout.css"),
  "utf8",
);
const analyticsCss = fs.readFileSync(
  path.join(dashboardDir, "youtubeVideoAnalyticsLayout.css"),
  "utf8",
);

describe("YouTube Video Analytics layout stylesheet", () => {
  it("keeps analytics chrome classes out of the hub layout sheet", () => {
    expect(hubCss).not.toMatch(/yt-video-analytics-toolbar/);
    expect(hubCss).not.toMatch(/yt-video-analytics-tabs/);
    expect(hubCss).not.toMatch(/yt-video-analytics-date/);
    expect(analyticsCss).toMatch(/\.yt-video-analytics-toolbar/);
    expect(analyticsCss).toMatch(/\.yt-video-analytics-tabs/);
    expect(analyticsCss).toMatch(/\.yt-video-analytics-tab--active/);
    expect(analyticsCss).toMatch(/\.yt-video-analytics-date/);
    expect(analyticsCss).toMatch(/#0f0f0f/);
    expect(analyticsCss).toMatch(/#606060/);
    expect(analyticsCss).toMatch(/@media \(max-width:\s*720px\)/);
  });

  it("keeps Overview layout classes in the feature sheet, not hub layout", () => {
    const overviewCss = fs.readFileSync(
      path.join(dashboardDir, "youtubeVideoAnalyticsOverview.css"),
      "utf8",
    );
    expect(hubCss).not.toMatch(/yt-video-analytics-overview/);
    expect(overviewCss).toMatch(/\.yt-video-analytics-overview \{/);
    expect(overviewCss).toMatch(/\.yt-video-analytics-overview__card/);
    expect(overviewCss).toMatch(/repeat\(3,/);
    expect(overviewCss).toMatch(/@media \(max-width:\s*720px\)/);
    expect(overviewCss).toMatch(/#ff0000/);
  });
});
