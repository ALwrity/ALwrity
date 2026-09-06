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
    expect(layoutCss).not.toMatch(/yt-comment-inbox-head/);
    expect(layoutCss).not.toMatch(/yt-comment-reply-btn/);

    expect(assistantCss).toMatch(/\.yt-comment-video-group-body--split/);
    expect(assistantCss).toMatch(/\.yt-comment-video-group-context/);
    expect(assistantCss).toMatch(/\.yt-comment-video-group-work/);
    expect(assistantCss).toMatch(/\.yt-comment-overflow-menu--portal/);
    expect(assistantCss).toMatch(/minmax\(200px,\s*320px\)/);
    expect(assistantCss).toMatch(/max-height:\s*min\(52vh,\s*28rem\)/);
    expect(assistantCss).toMatch(/@media \(max-width:\s*720px\)/);
    expect(assistantCss).toMatch(/\.yt-comment-like-count/);
    expect(assistantCss).toMatch(/\.yt-comment-inbox-head/);
    expect(assistantCss).toMatch(/color:\s*#606060/);
    expect(assistantCss).toMatch(/\.yt-comment-reply-btn/);
    expect(assistantCss).toMatch(/\.yt-comment-reply-btn:hover:not\(:disabled\)/);
    expect(assistantCss).toMatch(/padding:\s*8px 14px/);
    expect(assistantCss).toMatch(/font-size:\s*0\.82rem/);
    expect(assistantCss).toMatch(/transform:\s*scale\(0\.94\)/);
    expect(assistantCss).toMatch(
      /linear-gradient\(135deg,\s*#CC0000 0%,\s*#991B1B 100%\)/,
    );
    expect(assistantCss).toMatch(/box-shadow:\s*0 4px 15px rgba\(204, 0, 0, 0\.35\)/);
    expect(assistantCss).toMatch(
      /\.yt-comment-actions \.yt-comment-reply-btn:disabled/,
    );
  });
});
