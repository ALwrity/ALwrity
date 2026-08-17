import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { ChannelBiblePanel } from "./ChannelBiblePanel";
import { YouTubeChannelBible } from "../../../services/youtubeApi";

const bible: YouTubeChannelBible = {
  channel_name: "",
  niche: "",
  target_audience: "Founders",
  default_video_goal: "",
  default_cta: "",
  brand_style: "",
  visual_style_guide: "",
  tone: "",
  default_avatar_url: null,
  default_language: "",
};

const emptyBible: YouTubeChannelBible = {
  ...bible,
  target_audience: "",
};

function renderPanel(
  profile: YouTubeChannelBible,
  handlers: {
    onChange: jest.Mock;
    onSave: jest.Mock;
    onApplyToThisVideo: jest.Mock;
  },
) {
  render(
    <ChannelBiblePanel
      bible={profile}
      onChange={handlers.onChange}
      onSave={handlers.onSave}
      onApplyToThisVideo={handlers.onApplyToThisVideo}
    />,
  );
  fireEvent.click(screen.getByText("Channel Bible"));
}

describe("ChannelBiblePanel", () => {
  const onChange = jest.fn();
  const onSave = jest.fn();
  const onApplyToThisVideo = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls onSave when Save channel defaults is clicked", () => {
    renderPanel(bible, { onChange, onSave, onApplyToThisVideo });
    fireEvent.click(screen.getByRole("button", { name: "Save channel defaults" }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("calls onApplyToThisVideo when Apply is clicked", () => {
    renderPanel(bible, { onChange, onSave, onApplyToThisVideo });
    fireEvent.click(screen.getByRole("button", { name: "Apply to this video" }));
    expect(onApplyToThisVideo).toHaveBeenCalledTimes(1);
  });

  it("calls onChange with updated niche", () => {
    renderPanel(bible, { onChange, onSave, onApplyToThisVideo });
    fireEvent.change(
      screen.getByPlaceholderText(/AI tools for founders/i),
      { target: { value: "Solo travel" } },
    );
    expect(onChange).toHaveBeenCalledWith({
      ...bible,
      niche: "Solo travel",
    });
  });

  it("shows example placeholders on empty fields", () => {
    renderPanel(emptyBible, { onChange, onSave, onApplyToThisVideo });
    expect(screen.getByPlaceholderText(/Tech Explained with Sarah/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/AI tools for founders/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Subscribe for weekly tips/i)).toBeInTheDocument();
  });

  it("allows empty niche and still saves", () => {
    renderPanel(emptyBible, { onChange, onSave, onApplyToThisVideo });
    expect(screen.getByText(/Save your channel defaults/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save channel defaults" }));
    expect(onSave).toHaveBeenCalled();
  });
});
