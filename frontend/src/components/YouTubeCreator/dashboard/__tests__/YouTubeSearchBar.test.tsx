/**
 * TDD: YouTube Creator Studio search field.
 * Mimics YouTube.com: search input, placeholder "Search", submit on Enter.
 * Keyword Search.list is owned by YouTubeStudioLandingHeader + youtubeStudioApi.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { YouTubeSearchBar } from "../YouTubeSearchBar";

describe("YouTubeSearchBar", () => {
  it("renders a YouTube search field", () => {
    render(<YouTubeSearchBar value="" onChange={vi.fn()} onSearch={vi.fn()} />);

    const field = screen.getByRole("searchbox", { name: /search youtube/i });
    expect(field).toBeTruthy();
    expect(field).toHaveProperty("placeholder", "Search");
  });

  it("notifies onChange when the query is typed", () => {
    const onChange = vi.fn();
    render(<YouTubeSearchBar value="" onChange={onChange} onSearch={vi.fn()} />);

    fireEvent.change(screen.getByRole("searchbox", { name: /search youtube/i }), {
      target: { value: "channel growth" },
    });

    expect(onChange).toHaveBeenCalledWith("channel growth");
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("calls onSearch when Enter is pressed", () => {
    const onSearch = vi.fn();
    render(
      <YouTubeSearchBar value="shorts ideas" onChange={vi.fn()} onSearch={onSearch} />,
    );

    fireEvent.keyDown(screen.getByRole("searchbox", { name: /search youtube/i }), {
      key: "Enter",
    });

    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it("does not call onSearch for other keys", () => {
    const onSearch = vi.fn();
    render(<YouTubeSearchBar value="a" onChange={vi.fn()} onSearch={onSearch} />);

    fireEvent.keyDown(screen.getByRole("searchbox", { name: /search youtube/i }), {
      key: "a",
    });

    expect(onSearch).not.toHaveBeenCalled();
  });

  it("logs submit metadata without the typed query text", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    render(
      <YouTubeSearchBar value="shorts ideas" onChange={vi.fn()} onSearch={vi.fn()} />,
    );

    fireEvent.keyDown(screen.getByRole("searchbox", { name: /search youtube/i }), {
      key: "Enter",
    });

    expect(info).toHaveBeenCalledWith("[YouTubeSearchBar] Search submitted", {
      queryLength: 12,
      hasQuery: true,
    });
    info.mockRestore();
  });

  it("swallows onChange errors and logs them", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <YouTubeSearchBar
        value=""
        onChange={() => {
          throw new Error("update failed");
        }}
        onSearch={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByRole("searchbox", { name: /search youtube/i }), {
      target: { value: "x" },
    });

    expect(error).toHaveBeenCalledWith(
      "[YouTubeSearchBar] Failed to update query",
      expect.any(Error),
    );
    error.mockRestore();
  });

  it("swallows onSearch errors and logs them", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <YouTubeSearchBar
        value="ideas"
        onChange={vi.fn()}
        onSearch={() => {
          throw new Error("submit failed");
        }}
      />,
    );

    fireEvent.keyDown(screen.getByRole("searchbox", { name: /search youtube/i }), {
      key: "Enter",
    });

    expect(error).toHaveBeenCalledWith(
      "[YouTubeSearchBar] Failed to submit search",
      expect.any(Error),
    );
    error.mockRestore();
  });
});
