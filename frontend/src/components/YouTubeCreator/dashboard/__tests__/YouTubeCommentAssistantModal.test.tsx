/**
 * Comment Reply Assistant modal: inbox, video groups, embed, empty/error.
 */
import { fireEvent, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import {
  inboxComment,
  mockedStudioApi,
  renderAssistant,
  stubLoadedInbox,
} from "./youtubeCommentAssistantTestSetup";

describe("YouTube Comment Reply Assistant modal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubLoadedInbox();
  });

  it("does not load inbox when closed", () => {
    renderAssistant(false);
    expect(mockedStudioApi.getCommentInbox).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Comment Reply Assistant" })).toBeNull();
  });

  it("loads inbox and shows author and comment text", async () => {
    renderAssistant();

    expect(screen.getByRole("dialog", { name: "Comment Reply Assistant" })).toBeTruthy();
    expect(screen.getByText(/Loading inbox/i)).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText("Sam")).toBeTruthy();
    });
    expect(screen.getByText("Sam")).toHaveClass("yt-comment-author");
    expect(screen.getByText("Loved the intro")).toBeTruthy();
    expect(screen.getByText("Rank Videos in 7 Days")).toBeTruthy();
    expect(screen.getAllByText("Rank Videos in 7 Days")).toHaveLength(1);
    expect(screen.getByText("Your video")).toBeTruthy();
    expect(screen.getByText("1 comment")).toBeTruthy();
    expect(screen.queryByText("abcdefghijk")).toBeNull();
    expect(screen.getByTestId("youtube-comment-iframe-player")).toHaveAttribute(
      "data-video-id",
      "abcdefghijk",
    );
    expect(mockedStudioApi.getCommentInbox).toHaveBeenCalledWith({ max_results: 20 });
  });

  it("groups comments on the same video under one Your video header", async () => {
    mockedStudioApi.getCommentInbox.mockResolvedValueOnce({
      success: true,
      comments: [
        inboxComment,
        {
          comment_id: "c-2",
          video_id: "abcdefghijk",
          video_title: "Rank Videos in 7 Days",
          author: "Lee",
          text: "Need a recap",
        },
      ],
    });
    renderAssistant();

    await waitFor(() => {
      expect(screen.getByText("Lee")).toBeTruthy();
    });
    expect(screen.getAllByText("Your video")).toHaveLength(1);
    expect(screen.getByText("2 comments")).toBeTruthy();
    expect(screen.getByText("Sam")).toBeTruthy();
    expect(screen.getByText("Need a recap")).toBeTruthy();
    expect(screen.getAllByText("Rank Videos in 7 Days")).toHaveLength(1);
  });

  it("keeps other videos as separate groups and expands the second on click", async () => {
    mockedStudioApi.getCommentInbox.mockResolvedValueOnce({
      success: true,
      comments: [
        inboxComment,
        {
          comment_id: "c-2",
          video_id: "otherVideo1",
          video_title: "Second upload",
          author: "Pat",
          text: "Great outro",
        },
      ],
    });
    renderAssistant();

    await waitFor(() => {
      expect(screen.getByText("Sam")).toBeTruthy();
    });
    expect(screen.getAllByText("Your video")).toHaveLength(2);
    expect(screen.getByText("Second upload")).toBeTruthy();
    expect(screen.queryByText("Pat")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Second upload/i }));

    await waitFor(() => {
      expect(screen.getByText("Pat")).toBeTruthy();
    });
    expect(screen.getByText("Great outro")).toBeTruthy();
    expect(screen.getAllByText("Your video")).toHaveLength(2);
  });

  it("collapsing a group hides its comments but keeps the Your video header", async () => {
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());

    fireEvent.click(
      screen.getByRole("button", { name: /Rank Videos in 7 Days/i }),
    );

    await waitFor(() => {
      expect(screen.queryByText("Sam")).toBeNull();
    });
    expect(screen.getByText("Your video")).toBeTruthy();
    expect(screen.getByText("Rank Videos in 7 Days")).toBeTruthy();
    expect(screen.queryByTestId("youtube-comment-iframe-player")).toBeNull();
  });

  it("does not embed a player for a non-YouTube video id", async () => {
    mockedStudioApi.getCommentInbox.mockResolvedValueOnce({
      success: true,
      comments: [
        {
          comment_id: "c-9",
          video_id: "vid-1",
          video_title: "Draft clip",
          author: "Sam",
          text: "Loved the intro",
        },
      ],
    });
    renderAssistant();

    await waitFor(() => {
      expect(screen.getByText("Sam")).toBeTruthy();
    });
    expect(screen.queryByTestId("youtube-comment-iframe-player")).toBeNull();
    expect(screen.getByText("Loved the intro")).toBeTruthy();
  });

  it("does not crash when inbox comments is not an array", async () => {
    mockedStudioApi.getCommentInbox.mockResolvedValueOnce({
      success: true,
      comments: null,
      message: "Loaded comments.",
    });
    renderAssistant();

    await waitFor(() => {
      expect(screen.getByText(/Could not load comments/i)).toBeTruthy();
    });
    expect(screen.queryByText("Your video")).toBeNull();
  });

  it("shows a short video id heading when title lookup fell back", async () => {
    mockedStudioApi.getCommentInbox.mockResolvedValueOnce({
      success: true,
      comments: [
        {
          comment_id: "c-2",
          video_id: "abcdefghijk",
          video_title: "abcdefgh",
          author: "Sam",
          text: "Loved the intro",
        },
      ],
    });
    renderAssistant();

    await waitFor(() => {
      expect(screen.getByText("abcdefgh")).toBeTruthy();
    });
    expect(screen.queryByText("abcdefghijk")).toBeNull();
    expect(screen.queryByText(/untitled/i)).toBeNull();
  });

  it("shows Video unavailable when the comment has no video id", async () => {
    mockedStudioApi.getCommentInbox.mockResolvedValueOnce({
      success: true,
      comments: [
        {
          comment_id: "c-3",
          author: "Sam",
          text: "Loved the intro",
        },
      ],
    });
    renderAssistant();

    await waitFor(() => {
      expect(screen.getByText("Video unavailable")).toBeTruthy();
    });
    expect(screen.queryByText(/untitled/i)).toBeNull();
  });

  it("shows empty copy when inbox has no comments", async () => {
    mockedStudioApi.getCommentInbox.mockResolvedValueOnce({
      success: true,
      comments: [],
      message: "Loaded 0 recent comments.",
    });
    renderAssistant();

    await waitFor(() => {
      expect(screen.getByText(/No recent comments found/i)).toBeTruthy();
    });
  });

  it("shows the inbox error message and no fake comments", async () => {
    mockedStudioApi.getCommentInbox.mockResolvedValueOnce({
      success: false,
      message: "Connect YouTube to load comments.",
      comments: [],
    });
    renderAssistant();

    await waitFor(() => {
      expect(screen.getByText("Connect YouTube to load comments.")).toBeTruthy();
    });
    expect(screen.queryByText("Sam")).toBeNull();
  });

  it("does not show thrown request text when inbox load fails", async () => {
    mockedStudioApi.getCommentInbox.mockRejectedValueOnce(
      new Error("Request failed with status code 500"),
    );
    renderAssistant();

    await waitFor(() => {
      expect(screen.getByText(/Could not load comments/i)).toBeTruthy();
    });
    expect(screen.queryByText(/status code 500/i)).toBeNull();
  });
});
