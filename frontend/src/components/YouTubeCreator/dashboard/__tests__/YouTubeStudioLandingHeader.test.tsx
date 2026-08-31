/**
 * TDD: Hub header must show the YouTube search bar (bar only this slice).
 */
import { render, screen } from "@testing-library/react";
import { YouTubeStudioLandingHeader } from "../YouTubeStudioLandingHeader";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("../../../shared/HeaderControls", () => ({
  default: () => <div data-testid="yt-header-controls" />,
}));

describe("YouTubeStudioLandingHeader", () => {
  it("keeps the Creator Studio brand", () => {
    render(<YouTubeStudioLandingHeader />);
    expect(screen.getByRole("heading", { name: /YouTube/i })).toBeTruthy();
  });

  it("shows the YouTube search bar on the Hub header", () => {
    render(<YouTubeStudioLandingHeader />);
    expect(screen.getByRole("searchbox", { name: /search youtube/i })).toBeTruthy();
  });
});
