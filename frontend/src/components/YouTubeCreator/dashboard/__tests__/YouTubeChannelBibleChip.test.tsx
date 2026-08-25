import type { Mock } from 'vitest';
import React from "react";
import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { YouTubeChannelBibleChip } from "../YouTubeChannelBibleChip";
import { openYouTubeChannelBible } from "../youtubeStudioEvents";
import { youtubeApi } from "../../../../services/youtubeApi";

vi.mock("../../../../services/youtubeApi", () => ({
  youtubeApi: {
    getChannelBible: vi.fn(),
    saveChannelBible: vi.fn(),
  },
}));

const bible = {
  channel_name: "",
  niche: "AI tools",
  target_audience: "Founders",
  default_video_goal: "",
  default_cta: "",
  brand_style: "",
  visual_style_guide: "",
  tone: "",
  default_avatar_url: null,
  default_language: "",
};

describe("YouTubeChannelBibleChip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (youtubeApi.getChannelBible as Mock).mockResolvedValue({
      success: true,
      bible,
      source: "saved",
    });
  });

  it("opens Channel Bible editor modal instead of switching to Video Creator", async () => {
    render(<YouTubeChannelBibleChip niche="AI tools" />);
    fireEvent.click(screen.getByRole("button", { name: /Channel Bible/i }));
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Channel Bible" })).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(youtubeApi.getChannelBible).toHaveBeenCalled();
    });
    expect(screen.getByTestId("channel-bible-standalone")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Open Channel Bible in Plan/i }),
    ).not.toBeInTheDocument();
  });

  it("opens from openYouTubeChannelBible event (Knowledge Centre)", async () => {
    render(<YouTubeChannelBibleChip />);
    act(() => {
      openYouTubeChannelBible();
    });
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Channel Bible" })).toBeInTheDocument();
    });
  });
});
