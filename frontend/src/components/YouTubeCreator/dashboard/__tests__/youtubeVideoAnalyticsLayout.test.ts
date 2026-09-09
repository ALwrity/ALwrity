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
    expect(overviewCss).toMatch(/yt-video-analytics-overview__card--active/);
    expect(overviewCss).toMatch(/yt-video-analytics-overview__axis/);
    expect(overviewCss).toMatch(/yt-video-analytics-overview__panel/);
    expect(overviewCss).toMatch(/border-radius:\s*14px/);
    expect(hubCss).not.toMatch(/yt-video-analytics-overview__panel/);
    expect(overviewCss).toMatch(/yt-video-analytics-overview__summary/);
    expect(overviewCss).toMatch(/yt-video-analytics-overview__metric-strip/);
    expect(overviewCss).toMatch(/yt-video-analytics-overview__chart-pane/);
    expect(overviewCss).not.toMatch(/#020617/);
    expect(overviewCss).not.toMatch(/#a855f7/);
    const overviewSource = [
      fs.readFileSync(
        path.join(dashboardDir, "modals", "YouTubeVideoAnalyticsOverview.tsx"),
        "utf8",
      ),
      fs.readFileSync(
        path.join(dashboardDir, "modals", "YouTubeVideoAnalyticsOverviewChart.tsx"),
        "utf8",
      ),
    ].join("\n");
    expect(overviewSource).not.toMatch(/recharts|PlatformAnalytics|CtrPositionChart/);
  });

  it("keeps the date menu sheet out of hub layout", () => {
    const dateMenuCss = fs.readFileSync(
      path.join(dashboardDir, "youtubeVideoAnalyticsDateMenu.css"),
      "utf8",
    );
    expect(hubCss).not.toMatch(/yt-video-analytics-date__menu/);
    expect(dateMenuCss).toMatch(/\.yt-video-analytics-date__menu/);
    expect(dateMenuCss).toMatch(/#f1f1f1/);
    expect(dateMenuCss).toMatch(/max-height:\s*280px/);
    expect(dateMenuCss).toMatch(/yt-video-analytics-date__menu--custom/);
    expect(dateMenuCss).toMatch(/input\[type=["']date["']\]/);
    expect(dateMenuCss).toMatch(/yt-video-analytics-date__custom-actions/);
  });

  it("keeps Audience layout classes in the feature sheet, not hub layout", () => {
    const audienceCss = fs.readFileSync(
      path.join(dashboardDir, "youtubeVideoAnalyticsAudience.css"),
      "utf8",
    );
    expect(hubCss).not.toMatch(/yt-video-analytics-audience/);
    expect(audienceCss).toMatch(/\.yt-video-analytics-audience \{/);
    expect(audienceCss).toMatch(/yt-video-analytics-audience__panel/);
    expect(audienceCss).toMatch(/yt-video-analytics-audience__stack/);
    expect(audienceCss).toMatch(/yt-video-analytics-audience__stack-seg/);
    expect(audienceCss).toMatch(/yt-video-analytics-audience__legend/);
    expect(audienceCss).toMatch(/flex-direction:\s*column/);
    expect(audienceCss).toMatch(/border-radius:\s*14px/);
    expect(audienceCss).toMatch(/#ff0000/);
    expect(audienceCss).toMatch(/#0f0f0f/);
    expect(audienceCss).not.toMatch(/#020617/);
    expect(audienceCss).not.toMatch(/#a855f7/);
    const audienceSource = fs.readFileSync(
      path.join(dashboardDir, "modals", "YouTubeVideoAnalyticsAudience.tsx"),
      "utf8",
    );
    expect(audienceSource).not.toMatch(/recharts|PlatformAnalytics|CtrPositionChart/);
  });
});
