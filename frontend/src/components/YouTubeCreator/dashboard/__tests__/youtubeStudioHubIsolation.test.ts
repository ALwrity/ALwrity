/**
 * Phase 4: Hub CSS must not isolate hub-main or the leaf modal backdrop.
 * Isolation on hub-main was Problem 1 (in-tree layers trapped under the rail).
 */
import * as fs from "fs";
import * as path from "path";

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

describe("YouTube Studio Hub isolation (Phase 4)", () => {
  const layoutCss = fs.readFileSync(
    path.join(__dirname, "../youtube-dashboard-layout.css"),
    "utf8",
  );

  it("does not isolate .yt-studio-hub-main", () => {
    const block = cssBlock(layoutCss, ".yt-studio-hub-main");
    expect(block).not.toMatch(/isolation\s*:/);
  });

  it("does not isolate .yt-modal-backdrop or duplicate z-index 13000 in CSS", () => {
    const block = cssBlock(layoutCss, ".yt-modal-backdrop");
    expect(block).not.toMatch(/isolation\s*:/);
    expect(block).not.toMatch(/z-index\s*:/);
  });
});
