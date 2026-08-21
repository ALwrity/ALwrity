import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { YouTubeVideoCreatorModal } from "../modals/YouTubeVideoCreatorModal";

jest.mock("../../YouTubeVideoCreatorPanel", () => ({
  YouTubeVideoCreatorPanel: () => (
    <div data-testid="yt-video-creator-panel">Video Creator Panel</div>
  ),
}));

describe("YouTubeVideoCreatorModal — additive host", () => {
  it("renders nothing when closed", () => {
    render(<YouTubeVideoCreatorModal open={false} onClose={jest.fn()} />);
    expect(screen.queryByRole("dialog", { name: /Video Creator/i })).toBeNull();
    expect(screen.queryByTestId("yt-video-creator-panel")).toBeNull();
  });

  it("renders pipeline shell with panel when open", () => {
    render(<YouTubeVideoCreatorModal open onClose={jest.fn()} />);
    expect(screen.getByRole("dialog", { name: /Video Creator/i })).toBeTruthy();
    expect(screen.getByTestId("yt-video-creator-panel")).toBeTruthy();
    expect(screen.getByText(/Plan → scenes → assets → render/i)).toBeTruthy();
  });

  it("calls onClose from close button and Studio Hub back", () => {
    const onClose = jest.fn();
    render(<YouTubeVideoCreatorModal open onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: /Close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /Back to Studio Hub/i }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
