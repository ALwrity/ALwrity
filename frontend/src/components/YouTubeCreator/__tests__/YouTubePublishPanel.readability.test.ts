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
  });
});
