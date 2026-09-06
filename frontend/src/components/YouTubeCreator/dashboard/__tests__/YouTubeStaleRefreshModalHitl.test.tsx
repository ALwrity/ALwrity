/**
 * Remarket Stale Refresh HITL — AI pack then Apply to YouTube.
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StaleRefreshModal } from "../modals/StaleRefreshModal";
import { youtubeStudioApi } from "../../../../services/youtubeStudioApi";

vi.mock("../../../../services/youtubeStudioApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../services/youtubeStudioApi")>();
  return {
    ...actual,
    youtubeStudioApi: {
      ...actual.youtubeStudioApi,
      listChannelVideos: vi.fn(),
      suggestStaleRefresh: vi.fn(),
      updateVideoMetadata: vi.fn(),
    },
  };
});

const mockedStudioApi = vi.mocked(youtubeStudioApi);

const listedVideo = {
  video_id: "vid-1",
  title: "Rank Videos in 7 Days",
  description: "How to rank",
  tags: ["seo", "youtube"],
  view_count: 50,
};

const suggestion = {
  new_title: "Rank YouTube Videos in 7 Days (2026)",
  new_description: "Updated description",
  new_tags: ["seo", "ranking"],
  pin_comment: "What should I cover next?",
  rationale: "Refresh year and CTA.",
};

async function renderLoadedStale() {
  mockedStudioApi.listChannelVideos.mockResolvedValue({
    success: true,
    videos: [listedVideo],
  });
  render(<StaleRefreshModal open onClose={vi.fn()} niche="seo" />);
  await waitFor(() => {
    expect(
      screen.getByRole("button", { name: "Rank Videos in 7 Days · 50 views" }),
    ).toBeTruthy();
  });
}

describe("YouTube Stale Refresh HITL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("asks AI for a refresh pack for the selected video", async () => {
    mockedStudioApi.suggestStaleRefresh.mockResolvedValueOnce({
      success: true,
      suggestion,
      message: "Refresh pack ready — review before applying (HITL).",
    });
    await renderLoadedStale();

    fireEvent.click(
      screen.getByRole("button", { name: "Rank Videos in 7 Days · 50 views" }),
    );

    await waitFor(() => {
      expect(screen.getByText("Rank YouTube Videos in 7 Days (2026)")).toBeTruthy();
    });
    expect(mockedStudioApi.suggestStaleRefresh).toHaveBeenCalledWith({
      title: "Rank Videos in 7 Days",
      description: "How to rank",
      tags: ["seo", "youtube"],
      niche: "seo",
    });
    expect(screen.getByText("Updated description")).toBeTruthy();
    expect(screen.getByText("seo, ranking")).toBeTruthy();
    expect(screen.getByText("Refresh year and CTA.")).toBeTruthy();
    expect(mockedStudioApi.updateVideoMetadata).not.toHaveBeenCalled();
  });

  it("shows unsuccessful suggest message and does not apply", async () => {
    mockedStudioApi.suggestStaleRefresh.mockResolvedValueOnce({
      success: false,
      message: "Could not generate a refresh pack.",
    });
    await renderLoadedStale();

    fireEvent.click(
      screen.getByRole("button", { name: "Rank Videos in 7 Days · 50 views" }),
    );

    await waitFor(() => {
      expect(screen.getByText("Could not generate a refresh pack.")).toBeTruthy();
    });
    expect(screen.queryByRole("button", { name: "Apply to YouTube (HITL)" })).toBeNull();
  });

  it("Apply to YouTube (HITL) updates metadata for the selected video", async () => {
    mockedStudioApi.suggestStaleRefresh.mockResolvedValueOnce({
      success: true,
      suggestion,
    });
    mockedStudioApi.updateVideoMetadata.mockResolvedValueOnce({
      success: true,
      video_id: "vid-1",
      message: "Metadata updated.",
    });
    await renderLoadedStale();

    fireEvent.click(
      screen.getByRole("button", { name: "Rank Videos in 7 Days · 50 views" }),
    );
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Apply to YouTube (HITL)" })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply to YouTube (HITL)" }));

    await waitFor(() => {
      expect(mockedStudioApi.updateVideoMetadata).toHaveBeenCalledWith({
        video_id: "vid-1",
        title: "Rank YouTube Videos in 7 Days (2026)",
        description: "Updated description",
        tags: ["seo", "ranking"],
      });
    });
    await waitFor(() => {
      expect(screen.getByText("Metadata updated.")).toBeTruthy();
    });
  });

  it("shows thrown apply error", async () => {
    mockedStudioApi.suggestStaleRefresh.mockResolvedValueOnce({
      success: true,
      suggestion,
    });
    mockedStudioApi.updateVideoMetadata.mockRejectedValueOnce(
      new Error("Update failed"),
    );
    await renderLoadedStale();

    fireEvent.click(
      screen.getByRole("button", { name: "Rank Videos in 7 Days · 50 views" }),
    );
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Apply to YouTube (HITL)" })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply to YouTube (HITL)" }));

    await waitFor(() => {
      expect(screen.getByText("Update failed")).toBeTruthy();
    });
  });

  it("shows unsuccessful apply message from the API", async () => {
    mockedStudioApi.suggestStaleRefresh.mockResolvedValueOnce({
      success: true,
      suggestion,
    });
    mockedStudioApi.updateVideoMetadata.mockResolvedValueOnce({
      success: false,
      message: "Video not found on this channel.",
    });
    await renderLoadedStale();

    fireEvent.click(
      screen.getByRole("button", { name: "Rank Videos in 7 Days · 50 views" }),
    );
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Apply to YouTube (HITL)" })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply to YouTube (HITL)" }));

    await waitFor(() => {
      expect(screen.getByText("Video not found on this channel.")).toBeTruthy();
    });
  });
});
