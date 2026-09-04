/**
 * Existing Comment Reply Assistant modal: inbox list, draft, HITL send.
 * Does not cover video-title grouping (not implemented yet).
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
  video_id: "vid-1",
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
    expect(screen.getByText("Loved the intro")).toBeTruthy();
    expect(mockedStudioApi.getCommentInbox).toHaveBeenCalledWith({ max_results: 20 });
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
    });
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
