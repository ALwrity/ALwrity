/**
 * Combined player is Combine + preview + download only.
 * Publish metadata fields live on RenderStep, not in this panel.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { YouTubeFinalVideoPanel } from "../components/YouTubeFinalVideoPanel";
import { fetchMediaBlobUrl, appendAuthTokenToUrl } from "../../../utils/fetchMediaBlobUrl";

vi.mock("../../../utils/fetchMediaBlobUrl", () => ({
  fetchMediaBlobUrl: vi.fn(),
  downloadMediaBlob: vi.fn(),
  appendAuthTokenToUrl: vi.fn(),
}));

const mockedFetchMediaBlobUrl = vi.mocked(fetchMediaBlobUrl);
const mockedAppendAuthTokenToUrl = vi.mocked(appendAuthTokenToUrl);

const FINAL_VIDEO_URL = "/api/youtube/videos/final.mp4";
const PANEL_SOURCE = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "components",
  "YouTubeFinalVideoPanel.tsx",
);

describe("YouTubeFinalVideoPanel does not host publish metadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAppendAuthTokenToUrl.mockImplementation(async (url) => `${url}?token=test`);
    mockedFetchMediaBlobUrl.mockResolvedValue("blob:youtube-final-video");
  });

  it("does not import YouTubePublishMetadataFields", () => {
    expect(readFileSync(PANEL_SOURCE, "utf8")).not.toContain("YouTubePublishMetadataFields");
  });

  it("does not render Title, Description, Tags, or Category without a combined video", () => {
    render(
      <YouTubeFinalVideoPanel
        finalVideoUrl={null}
        combining={false}
        combiningProgress={0}
        combiningMessage="Starting..."
        onCombine={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText("Title")).toBeNull();
    expect(screen.queryByLabelText("Description")).toBeNull();
    expect(screen.queryByLabelText("Tags")).toBeNull();
    expect(screen.queryByLabelText("Category")).toBeNull();
  });

  it("does not render metadata fields beside the combined player", async () => {
    render(
      <YouTubeFinalVideoPanel
        finalVideoUrl={FINAL_VIDEO_URL}
        combining={false}
        combiningProgress={100}
        combiningMessage="Done"
        onCombine={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(document.querySelector("video")).not.toBeNull();
    });
    expect(screen.queryByLabelText("Title")).toBeNull();
    expect(screen.queryByLabelText("Description")).toBeNull();
    expect(screen.queryByLabelText("Tags")).toBeNull();
    expect(screen.queryByLabelText("Category")).toBeNull();
  });
});
