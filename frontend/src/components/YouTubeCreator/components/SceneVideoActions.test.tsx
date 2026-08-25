import React from "react";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SceneVideoActions } from "./SceneVideoActions";
import { Scene } from "../../../services/youtubeApi";
import { downloadMediaBlob } from "../../../utils/fetchMediaBlobUrl";

vi.mock("../../../utils/fetchMediaBlobUrl", () => ({
  downloadMediaBlob: vi.fn(),
}));

const mockedDownloadMediaBlob = vi.mocked(downloadMediaBlob);

const scene: Scene = {
  scene_number: 1,
  title: "Hook",
  narration: "Hello",
  visual_prompt: "A studio shot",
  duration_estimate: 5,
  visual_cues: [],
  emphasis_tags: [],
  enabled: true,
  imageUrl: "/api/youtube/images/scenes/s1.png",
  audioUrl: "/api/youtube/audio/s1.mp3",
  videoUrl: "/api/youtube/videos/scene_1.mp4",
};

describe("SceneVideoActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedDownloadMediaBlob.mockResolvedValue();
  });

  it("shows preview and download when the scene video is ready", () => {
    render(
      <SceneVideoActions
        scene={scene}
        running={false}
        failed={false}
        completed
        hasAssets
        progress={100}
        onPreview={vi.fn()}
        onGenerate={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Preview scene 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Download scene 1 video")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeInTheDocument();
  });

  it("hides download until a scene video URL exists", () => {
    render(
      <SceneVideoActions
        scene={{ ...scene, videoUrl: undefined }}
        running={false}
        failed={false}
        completed={false}
        hasAssets
        progress={0}
        onPreview={vi.fn()}
        onGenerate={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText("Download scene 1 video")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate Video" })).toBeInTheDocument();
  });

  it("downloads the scene video with downloadMediaBlob", async () => {
    render(
      <SceneVideoActions
        scene={scene}
        running={false}
        failed={false}
        completed
        hasAssets
        progress={100}
        onPreview={vi.fn()}
        onGenerate={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText("Download scene 1 video"));

    await waitFor(() => {
      expect(mockedDownloadMediaBlob).toHaveBeenCalledTimes(1);
    });
    expect(mockedDownloadMediaBlob.mock.calls[0][0]).toBe("/api/youtube/videos/scene_1.mp4");
  });
});
