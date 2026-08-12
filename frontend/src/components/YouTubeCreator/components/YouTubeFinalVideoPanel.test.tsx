import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { YouTubeFinalVideoPanel } from "./YouTubeFinalVideoPanel";
import { downloadMediaBlob, fetchMediaBlobUrl } from "../../../utils/fetchMediaBlobUrl";

jest.mock("../../../utils/fetchMediaBlobUrl", () => ({
  fetchMediaBlobUrl: jest.fn(),
  downloadMediaBlob: jest.fn(),
}));

const mockedFetchMediaBlobUrl = fetchMediaBlobUrl as jest.MockedFunction<typeof fetchMediaBlobUrl>;
const mockedDownloadMediaBlob = downloadMediaBlob as jest.MockedFunction<typeof downloadMediaBlob>;

describe("YouTubeFinalVideoPanel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows combine action when final video is not ready", () => {
    const onCombine = jest.fn();

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
        onCombine={jest.fn()}
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

  it("downloads final video using media blob helper", async () => {
    mockedFetchMediaBlobUrl.mockResolvedValueOnce("blob:youtube-final-video");
    mockedDownloadMediaBlob.mockResolvedValueOnce();

    render(
      <YouTubeFinalVideoPanel
        finalVideoUrl="/api/youtube/videos/final.mp4"
        combining={false}
        combiningProgress={100}
        combiningMessage="Done"
        onCombine={jest.fn()}
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

