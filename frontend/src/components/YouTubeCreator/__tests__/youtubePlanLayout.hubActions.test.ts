/**
 * Plan Your Video Hub chip hover/tooltip sheet — same pattern as Audience chips.
 */
import * as fs from "fs";
import * as path from "path";

const css = fs.readFileSync(
  path.join(__dirname, "../components/youtubePlanLayout.css"),
  "utf8",
);

describe("youtubePlanLayout Hub hover tooltips", () => {
  it("matches Audience chip hover scale, Hub red, and data-tooltip chrome", () => {
    expect(css).toMatch(/\.yt-plan-hub-action:hover:not\(:disabled\)[\s\S]*border-color:\s*#ff0000/);
    expect(css).toMatch(/\.yt-plan-hub-action:hover:not\(:disabled\)[\s\S]*scale\(/);
    expect(css).toMatch(/linear-gradient\(135deg,\s*#CC0000 0%,\s*#991B1B 100%\)/);
    expect(css).toMatch(/attr\(data-tooltip\)/);
    expect(css).toMatch(/\.yt-plan-hub-action:hover::after/);
    expect(css).toMatch(/\.yt-plan-hub-action:focus-visible::after/);
    expect(css).toMatch(/\.yt-plan-hub-action::after[\s\S]*background:\s*#fff/);
    expect(css).toMatch(/\.yt-plan-hub-action::after[\s\S]*color:\s*#0f0f0f/);
    expect(css).not.toMatch(/667eea|#9c27b0|#a855f7/);
  });

  it("does not clip Hub tooltips inside plan panes", () => {
    expect(css).toMatch(/\.yt-plan-pane \{[\s\S]*overflow:\s*visible/);
    expect(css).toMatch(/\.yt-plan-pane__body \{[\s\S]*overflow:\s*visible/);
  });

  it("opens the wide Enhance tooltip above the button so Brainstorm does not cover it", () => {
    expect(css).toMatch(
      /\.yt-plan-hub-action--wide::after[\s\S]*bottom:\s*calc\(100%\s*\+\s*8px\)/,
    );
    expect(css).toMatch(/\.yt-plan-hub-action-wrap--wide[\s\S]*left:\s*0/);
  });
});
