/**
 * Comment Reply Assistant layout CSS lives in its own YouTube-named sheet
 * so youtube-dashboard-layout.css is not grown past the golden-rule limit.
 */
import * as fs from "fs";
import * as path from "path";

const dashboardDir = path.join(__dirname, "..");
const layoutCssPath = path.join(dashboardDir, "youtube-dashboard-layout.css");
const assistantLayoutCssPath = path.join(
  dashboardDir,
  "youtubeCommentAssistantLayout.css",
);
const dashboardStylesPath = path.join(dashboardDir, "youtubeStudioDashboardStyles.ts");

describe("YouTube Comment Reply Assistant layout stylesheet", () => {
  it("is a dedicated YouTube-named CSS file imported after hub layout CSS", () => {
    const stylesEntry = fs.readFileSync(dashboardStylesPath, "utf8");
    const layoutImport = stylesEntry.indexOf('import "./youtube-dashboard-layout.css"');
    const assistantImport = stylesEntry.indexOf(
      'import "./youtubeCommentAssistantLayout.css"',
    );
    expect(layoutImport).toBeGreaterThanOrEqual(0);
    expect(assistantImport).toBeGreaterThan(layoutImport);
  });

  it("keeps context/work split and portal menu rules out of the hub layout sheet", () => {
    const layoutCss = fs.readFileSync(layoutCssPath, "utf8");
    const assistantCss = fs.readFileSync(assistantLayoutCssPath, "utf8");

    expect(layoutCss).not.toMatch(/yt-comment-video-group-body--split/);
    expect(layoutCss).not.toMatch(/yt-comment-video-group-context/);
    expect(layoutCss).not.toMatch(/yt-comment-video-group-work/);
    expect(layoutCss).not.toMatch(/yt-comment-overflow-menu--portal/);
    expect(layoutCss).not.toMatch(/yt-comment-like-count/);

    expect(assistantCss).toMatch(/\.yt-comment-video-group-body--split/);
    expect(assistantCss).toMatch(/\.yt-comment-video-group-context/);
    expect(assistantCss).toMatch(/\.yt-comment-video-group-work/);
    expect(assistantCss).toMatch(/\.yt-comment-overflow-menu--portal/);
    expect(assistantCss).toMatch(/minmax\(200px,\s*320px\)/);
    expect(assistantCss).toMatch(/max-height:\s*min\(52vh,\s*28rem\)/);
    expect(assistantCss).toMatch(/@media \(max-width:\s*720px\)/);
    expect(assistantCss).toMatch(/\.yt-comment-like-count/);
    expect(assistantCss).toMatch(/color:\s*#606060/);
  });
});
