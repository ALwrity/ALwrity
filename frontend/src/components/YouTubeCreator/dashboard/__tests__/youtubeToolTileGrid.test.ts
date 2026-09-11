/**
 * Hub tool tiles share one grid. auto-fill keeps Analysis/Engagement cells
 * the same width as Remarket instead of stretching leftover columns.
 */
import * as fs from "fs";
import * as path from "path";

const dashboardDir = path.join(__dirname, "..");
const hubCss = fs.readFileSync(
  path.join(dashboardDir, "youtube-dashboard-layout.css"),
  "utf8",
);

function cssBlock(css: string, selector: string): string {
  const needle = `${selector} {`;
  const start = css.indexOf(needle);
  if (start < 0) {
    throw new Error(`Missing CSS rule ${selector}`);
  }
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  return css.slice(open, close + 1);
}

function modalSource(fileName: string): string {
  return fs.readFileSync(path.join(dashboardDir, "modals", fileName), "utf8");
}

describe("YouTube Hub tool tile grid", () => {
  it("keeps empty tracks with auto-fill and the same 180px min as Remarket", () => {
    const block = cssBlock(hubCss, ".yt-tool-tile-grid");
    expect(block).toMatch(/repeat\(auto-fill,\s*minmax\(180px,\s*1fr\)\)/);
    expect(block).not.toMatch(/auto-fit/);
  });

  it("uses the shared yt-tool-tile-grid on Hub wedges that show tool tiles", () => {
    for (const fileName of [
      "AnalysisWedgeModal.tsx",
      "EngagementWedgeModal.tsx",
      "RemarketWedgeModal.tsx",
      "CreateWedgeModal.tsx",
      "PublishWedgeModal.tsx",
    ]) {
      expect(modalSource(fileName)).toMatch(/className="yt-tool-tile-grid"/);
    }
  });

  it("uses a shared tile min-height so Analysis cards match Engagement and Remarket", () => {
    const tile = cssBlock(hubCss, ".yt-tool-tile");
    const hitl = cssBlock(hubCss, ".yt-tool-tile-hitl");
    expect(tile).toMatch(/display:\s*flex/);
    expect(tile).toMatch(/flex-direction:\s*column/);
    expect(tile).toMatch(/min-height:\s*148px/);
    expect(tile).toMatch(/box-sizing:\s*border-box/);
    expect(hitl).toMatch(/margin-top:\s*auto/);
  });
});
