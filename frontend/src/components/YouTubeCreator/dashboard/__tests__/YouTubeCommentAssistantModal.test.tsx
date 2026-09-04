/**
 * Existing Comment Reply Assistant modal: inbox list, video heading, draft, HITL send.
 * Hub chrome and Podcast Maker are out of scope.
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { CommentAssistantModal } from "../modals/CommentAssistantModal";
import { youtubeStudioApi } from "../../../../services/youtubeStudioApi";

vi.mock("../../../../services/youtubeStudioApi", () => ({
  youtubeStudioApi: {
    getCommentInbox: vi.fn(),
    draftCommentReply: vi.fn(),
    sendCommentReply: vi.fn(),
  },
}));

const mockedStudioApi = vi.mocked(youtubeStudioApi);

const inboxComment = {
  comment_id: "c-1",
  video_id: "abcdefghijk",
  video_title: "Rank Videos in 7 Days",
  author: "Sam",
  text: "Loved the intro",
};

function renderAssistant(open = true) {
  return render(
    <CommentAssistantModal open={open} onClose={vi.fn()} niche="seo" />,
  );
}

describe("YouTube Comment Reply Assistant modal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedStudioApi.getCommentInbox.mockResolvedValue({
      success: true,
      comments: [inboxComment],
      message: "Loaded 1 recent comments.",
    });
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
  });

  it("Draft with AI still uses the selected row when a video has two comments", async () => {
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
    mockedStudioApi.draftCommentReply.mockResolvedValueOnce({
      success: true,
      draft: "Here is a recap.",
    });
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Lee")).toBeTruthy());

    fireEvent.click(screen.getAllByRole("button", { name: "Draft with AI" })[1]);

    await waitFor(() => {
      expect(mockedStudioApi.draftCommentReply).toHaveBeenCalledWith({
        comment_text: "Need a recap",
        channel_niche: "seo",
        video_title: "Rank Videos in 7 Days",
      });
    });
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

  it("Draft with AI fills the reply box from the draft endpoint", async () => {
    mockedStudioApi.draftCommentReply.mockResolvedValueOnce({
      success: true,
      draft: "Thanks for watching — what did you try first?",
    });
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "Draft with AI" }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Draft reply…")).toHaveValue(
        "Thanks for watching — what did you try first?",
      );
    });
    expect(mockedStudioApi.draftCommentReply).toHaveBeenCalledWith({
      comment_text: "Loved the intro",
      channel_niche: "seo",
      video_title: "Rank Videos in 7 Days",
    });
  });

  it("shows Draft with AI unsuccessful message from the API", async () => {
    mockedStudioApi.draftCommentReply.mockResolvedValueOnce({
      success: false,
      error_code: "empty_draft",
      message: "Could not draft a reply. Try again.",
    });
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "Draft with AI" }));

    await waitFor(() => {
      expect(screen.getByText("Could not draft a reply. Try again.")).toBeTruthy();
    });
    expect(screen.getByPlaceholderText("Draft reply…")).toHaveValue("");
  });

  it("does not show thrown request text when draft fails", async () => {
    mockedStudioApi.draftCommentReply.mockRejectedValueOnce(
      new Error("Request failed with status code 502"),
    );
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "Draft with AI" }));

    await waitFor(() => {
      expect(screen.getByText(/Could not draft a reply/i)).toBeTruthy();
    });
    expect(screen.queryByText(/status code 502/i)).toBeNull();
  });

  it("Send (HITL) posts the edited draft under the parent comment id", async () => {
    mockedStudioApi.sendCommentReply.mockResolvedValueOnce({
      success: true,
      comment_id: "reply-9",
      message: "Reply published.",
    });
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());

    const send = screen.getByRole("button", { name: "Send (HITL)" });
    expect(send).toHaveProperty("disabled", true);

    fireEvent.change(screen.getByPlaceholderText("Draft reply…"), {
      target: { value: "Thanks for watching" },
    });
    fireEvent.click(send);

    await waitFor(() => {
      expect(mockedStudioApi.sendCommentReply).toHaveBeenCalledWith({
        parent_id: "c-1",
        text: "Thanks for watching",
      });
    });
    await waitFor(() => {
      expect(screen.getByText("Reply published.")).toBeTruthy();
    });
    expect(mockedStudioApi.getCommentInbox.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("shows Send (HITL) unsuccessful insert message from the API", async () => {
    mockedStudioApi.sendCommentReply.mockResolvedValueOnce({
      success: false,
      error_code: "operationNotSupported",
      message: "YouTube would not allow a reply on that comment.",
    });
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());
    fireEvent.change(screen.getByPlaceholderText("Draft reply…"), {
      target: { value: "Thanks for watching" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send (HITL)" }));

    await waitFor(() => {
      expect(
        screen.getByText("YouTube would not allow a reply on that comment."),
      ).toBeTruthy();
    });
    expect(mockedStudioApi.getCommentInbox.mock.calls.length).toBe(1);
  });

  it("does not show thrown request text when send fails", async () => {
    mockedStudioApi.sendCommentReply.mockRejectedValueOnce(
      new Error("Request failed with status code 503"),
    );
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());
    fireEvent.change(screen.getByPlaceholderText("Draft reply…"), {
      target: { value: "Thanks for watching" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send (HITL)" }));

    await waitFor(() => {
      expect(screen.getByText(/Could not send that reply/i)).toBeTruthy();
    });
    expect(screen.queryByText(/status code 503/i)).toBeNull();
  });
});
