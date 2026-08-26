import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { YouTubeFinalVideoPanel } from "./YouTubeFinalVideoPanel";
import { downloadMediaBlob, fetchMediaBlobUrl, appendAuthTokenToUrl } from "../../../utils/fetchMediaBlobUrl";

vi.mock("../../../utils/fetchMediaBlobUrl", () => ({
  fetchMediaBlobUrl: vi.fn(),
  downloadMediaBlob: vi.fn(),
  appendAuthTokenToUrl: vi.fn(),
}));

const mockedFetchMediaBlobUrl = vi.mocked(fetchMediaBlobUrl);
const mockedDownloadMediaBlob = vi.mocked(downloadMediaBlob);
const mockedAppendAuthTokenToUrl = vi.mocked(appendAuthTokenToUrl);

describe("YouTubeFinalVideoPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAppendAuthTokenToUrl.mockImplementation(async (url) => `${url}?token=test`);
  });

  it("shows combine action when final video is not ready", () => {
    const onCombine = vi.fn();

    render(
      <YouTubeFinalVideoPanel
        finalVideoUrl={null}
        combining={false}
        combiningProgress={0}
        combiningMessage="Starting..."
        onCombine={onCombine}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Combine Into Final Video" }));
    expect(onCombine).toHaveBeenCalledTimes(1);
  });

  it("loads secure blob preview when final video URL is available", async () => {
    mockedFetchMediaBlobUrl.mockResolvedValueOnce("blob:youtube-final-video");

    render(
      <YouTubeFinalVideoPanel
        finalVideoUrl="/api/youtube/videos/final.mp4"
        combining={false}
        combiningProgress={100}
        combiningMessage="Done"
        onCombine={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(mockedFetchMediaBlobUrl).toHaveBeenCalledWith("/api/youtube/videos/final.mp4");
    });

    await waitFor(() => {
      const video = document.querySelector("video");
      expect(video).not.toBeNull();
      expect(video?.getAttribute("src")).toBe("blob:youtube-final-video");
    });
  });

  it("falls back to authenticated URL instead of the raw video path", async () => {
    mockedFetchMediaBlobUrl.mockResolvedValueOnce(null);

    render(
      <YouTubeFinalVideoPanel
        finalVideoUrl="/api/youtube/videos/final.mp4"
        combining={false}
        combiningProgress={100}
        combiningMessage="Done"
        onCombine={vi.fn()}
      />,
    );

    await waitFor(() => {
      const video = document.querySelector("video");
      expect(video).not.toBeNull();
      expect(video?.getAttribute("src")).toBe("/api/youtube/videos/final.mp4?token=test");
      expect(video?.getAttribute("src")).not.toBe("/api/youtube/videos/final.mp4");
    });
  });

  it("downloads final video using media blob helper", async () => {
    mockedFetchMediaBlobUrl.mockResolvedValueOnce("blob:youtube-final-video");
    mockedDownloadMediaBlob.mockResolvedValueOnce();

    render(
      <YouTubeFinalVideoPanel
        finalVideoUrl="/api/youtube/videos/final.mp4"
        combining={false}
        combiningProgress={100}
        combiningMessage="Done"
        onCombine={vi.fn()}
      />,
    );

    const downloadButton = await screen.findByRole("button", { name: "Download Final Video" });
    fireEvent.click(downloadButton);

    await waitFor(() => {
      expect(mockedDownloadMediaBlob).toHaveBeenCalledTimes(1);
    });
    expect(mockedDownloadMediaBlob.mock.calls[0][0]).toBe("/api/youtube/videos/final.mp4");
  });
});

