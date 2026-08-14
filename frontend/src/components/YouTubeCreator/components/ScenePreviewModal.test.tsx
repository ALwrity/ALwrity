import React from "react";
import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { ScenePreviewModal } from "./ScenePreviewModal";
import { appendAuthTokenToUrl, fetchMediaBlobUrl } from "../../../utils/fetchMediaBlobUrl";

jest.mock("../../../utils/fetchMediaBlobUrl", () => ({
  fetchMediaBlobUrl: jest.fn(),
  appendAuthTokenToUrl: jest.fn(),
}));

const mockedFetchMediaBlobUrl = fetchMediaBlobUrl as jest.MockedFunction<typeof fetchMediaBlobUrl>;
const mockedAppendAuthTokenToUrl = appendAuthTokenToUrl as jest.MockedFunction<typeof appendAuthTokenToUrl>;

describe("ScenePreviewModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedFetchMediaBlobUrl.mockResolvedValue(null);
    mockedAppendAuthTokenToUrl.mockImplementation(async (url) => `${url}?token=test`);
  });

  it("renders scene video player when videoUrl is provided", async () => {
    mockedFetchMediaBlobUrl.mockResolvedValue("blob:scene-video");

    render(
      <ScenePreviewModal
        open
        onClose={jest.fn()}
        sceneTitle="Price Shock"
        sceneNumber={1}
        videoUrl="/api/youtube/videos/scene_1.mp4"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Scene 1 Preview")).toBeInTheDocument();
      expect(screen.getByText("Scene Video")).toBeInTheDocument();
      const video = document.querySelector("video");
      expect(video).not.toBeNull();
      expect(video?.getAttribute("src")).toBe("blob:scene-video");
    });
  });

  it("uses authenticated token URL when video blob load fails", async () => {
    mockedFetchMediaBlobUrl.mockRejectedValue(new Error("unauthorized"));

    render(
      <ScenePreviewModal
        open
        onClose={jest.fn()}
        sceneTitle="Price Shock"
        sceneNumber={2}
        videoUrl="/api/youtube/videos/scene_2.mp4"
      />,
    );

    await waitFor(() => {
      const video = document.querySelector("video");
      expect(video?.getAttribute("src")).toBe("/api/youtube/videos/scene_2.mp4?token=test");
    });
  });

  it("does not render a video element when videoUrl is missing", async () => {
    render(
      <ScenePreviewModal
        open
        onClose={jest.fn()}
        sceneTitle="No video yet"
        sceneNumber={3}
        imageUrl="/api/youtube/images/scenes/s3.png"
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText("Scene Video")).not.toBeInTheDocument();
      expect(document.querySelector("video")).toBeNull();
    });
  });
});
