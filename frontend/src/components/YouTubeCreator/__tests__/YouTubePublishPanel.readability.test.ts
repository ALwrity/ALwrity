/**
 * Privacy and Schedule on Connect & Publish must stay readable on the white
 * Creator surface (global MUI theme is dark). Hub wedge is out of scope.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PANEL_SOURCE = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "components",
  "YouTubePublishPanel.tsx",
);

describe("YouTubePublishPanel privacy and schedule readability", () => {
  it("reuses Creator inputSx, selectSx, labelSx, helperSx, and selectMenuProps", () => {
    const source = readFileSync(PANEL_SOURCE, "utf8");
    expect(source).toContain("inputSx");
    expect(source).toContain("selectSx");
    expect(source).toContain("labelSx");
    expect(source).toContain("helperSx");
    expect(source).toContain("selectMenuProps");
    expect(source).toContain("youtubeScheduleFieldSx");
  });

  it("merges inputSx with schedule styles so the outlined border is not wiped", () => {
    const source = readFileSync(PANEL_SOURCE, "utf8");
    expect(source).toContain("sx={[inputSx, youtubeScheduleFieldSx]}");
  });

  it("does not disable Privacy when a schedule time is set", () => {
    const source = readFileSync(PANEL_SOURCE, "utf8");
    expect(source).not.toContain("disabled={Boolean(scheduleLocal)}");
  });

  it("logs selected vs effective privacy and skips invalid schedules", () => {
    const source = readFileSync(PANEL_SOURCE, "utf8");
    expect(source).toContain("selectedPrivacy");
    expect(source).toContain("effectivePrivacy");
    expect(source).toContain("Publish skipped: invalid schedule");
    expect(source).toContain("hasValidPublishAt");
    expect(source).toContain("youtubeScheduleIsInvalid");
  });
});
