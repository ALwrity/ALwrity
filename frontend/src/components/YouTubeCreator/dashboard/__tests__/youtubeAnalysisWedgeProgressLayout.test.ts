/**
 * Analysis wedge Pulse/Performance progress CSS stays out of hub layout.
 */
import * as fs from "fs";
import * as path from "path";

const dashboardDir = path.join(__dirname, "..");

describe("YouTube Analysis wedge progress stylesheet", () => {
  it("keeps progress chrome in the feature sheet, not hub layout", () => {
    const hubCss = fs.readFileSync(
      path.join(dashboardDir, "youtube-dashboard-layout.css"),
      "utf8",
    );
    const progressCss = fs.readFileSync(
      path.join(dashboardDir, "youtubeAnalysisWedgeProgress.css"),
      "utf8",
    );
    expect(hubCss).not.toMatch(/yt-analysis-wedge-progress/);
    expect(progressCss).toMatch(/\.yt-analysis-wedge-progress/);
    expect(progressCss).toMatch(/margin:\s*0/);
  });
});
