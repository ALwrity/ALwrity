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
    listCommentReplies: vi.fn(),
    updateCommentReply: vi.fn(),
    deleteCommentReply: vi.fn(),
  },
}));

vi.mock("../YouTubeCommentIframePlayer", () => ({
  YouTubeCommentIframePlayer: ({ videoId }: { videoId: string }) => (
    <div data-testid="youtube-comment-iframe-player" data-video-id={videoId} />
  ),
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

  it("lists nested replies under the parent and keeps Draft/Send on the parent", async () => {
    mockedStudioApi.getCommentInbox.mockResolvedValueOnce({
      success: true,
      comments: [
        {
          ...inboxComment,
          total_reply_count: 2,
          replies: [
            { comment_id: "r-1", author: "Pat", text: "Me too" },
            { comment_id: "r-2", author: "Lee", text: "Same here" },
          ],
        },
      ],
    });
    renderAssistant();

    await waitFor(() => {
      expect(screen.getByText("Pat")).toBeTruthy();
    });
    expect(screen.getByText("Me too")).toBeTruthy();
    expect(screen.getByText("Lee")).toBeTruthy();
    expect(screen.getByText("Same here")).toBeTruthy();
    expect(screen.getByText("Replies")).toBeTruthy();
    expect(screen.getByText("2 replies")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Draft with AI" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Send (HITL)" })).toHaveLength(1);
    expect(mockedStudioApi.listCommentReplies).not.toHaveBeenCalled();
  });

  it("does not show a Replies heading when the parent has no replies", async () => {
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());
    expect(screen.queryByText("Replies")).toBeNull();
    expect(screen.queryByText("1 reply")).toBeNull();
    expect(screen.queryByText(/^\d+ replies$/)).toBeNull();
    expect(mockedStudioApi.listCommentReplies).not.toHaveBeenCalled();
  });

  it("Show more replies loads extra rows with parent_id", async () => {
    mockedStudioApi.getCommentInbox.mockResolvedValueOnce({
      success: true,
      comments: [
        {
          ...inboxComment,
          total_reply_count: 3,
          replies: [{ comment_id: "r-1", author: "Pat", text: "Me too" }],
        },
      ],
    });
    mockedStudioApi.listCommentReplies.mockResolvedValueOnce({
      success: true,
      replies: [
        { comment_id: "r-1", author: "Pat", text: "Me too" },
        { comment_id: "r-3", author: "Kim", text: "Thanks" },
      ],
    });
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Pat")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "Show more replies" }));

    await waitFor(() => {
      expect(screen.getByText("Kim")).toBeTruthy();
    });
    expect(screen.getByText("Thanks")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Show more replies" })).toBeNull();
    expect(mockedStudioApi.listCommentReplies).toHaveBeenCalledWith({
      parent_id: "c-1",
      max_results: 20,
    });
  });

  it("shows a user-safe Show more error and keeps the parent comment", async () => {
    mockedStudioApi.getCommentInbox.mockResolvedValueOnce({
      success: true,
      comments: [
        {
          ...inboxComment,
          total_reply_count: 8,
          replies: [{ comment_id: "r-1", author: "Pat", text: "Me too" }],
        },
      ],
    });
    mockedStudioApi.listCommentReplies.mockResolvedValueOnce({
      success: false,
      message: "That comment could not be found. It may have been removed.",
    });
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "Show more replies" }));

    await waitFor(() => {
      expect(
        screen.getByText("That comment could not be found. It may have been removed."),
      ).toBeTruthy();
    });
    expect(screen.getByText("Sam")).toBeTruthy();
    expect(screen.getByText("Loved the intro")).toBeTruthy();
    expect(screen.getByText("Pat")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Show more replies" })).toBeTruthy();
  });

  it("does not show thrown request text when Show more fails", async () => {
    mockedStudioApi.getCommentInbox.mockResolvedValueOnce({
      success: true,
      comments: [
        {
          ...inboxComment,
          total_reply_count: 8,
          replies: [{ comment_id: "r-1", author: "Pat", text: "Me too" }],
        },
      ],
    });
    mockedStudioApi.listCommentReplies.mockRejectedValueOnce(
      new Error("Request failed with status code 500"),
    );
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "Show more replies" }));

    await waitFor(() => {
      expect(screen.getByText(/Could not load replies/i)).toBeTruthy();
    });
    expect(screen.queryByText(/status code 500/i)).toBeNull();
    expect(screen.getByText("Sam")).toBeTruthy();
  });

  it("shows Show more when YouTube truncated replies and none were inlined", async () => {
    mockedStudioApi.getCommentInbox.mockResolvedValueOnce({
      success: true,
      comments: [
        {
          ...inboxComment,
          total_reply_count: 6,
          replies: [],
        },
      ],
    });
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());

    expect(screen.getByText("Replies")).toBeTruthy();
    expect(screen.getByText("6 replies")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Show more replies" })).toBeTruthy();
    expect(mockedStudioApi.listCommentReplies).not.toHaveBeenCalled();
  });

  it("shows Edit overflow only on the creator's own reply", async () => {
    mockedStudioApi.getCommentInbox.mockResolvedValueOnce({
      success: true,
      comments: [
        {
          ...inboxComment,
          total_reply_count: 2,
          replies: [
            {
              comment_id: "r-own",
              author: "MyChannel",
              text: "Thanks",
              can_edit: true,
            },
            {
              comment_id: "r-viewer",
              author: "Pat",
              text: "Me too",
              can_edit: false,
            },
          ],
        },
      ],
    });
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Pat")).toBeTruthy());

    expect(screen.getAllByRole("button", { name: "More actions" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(screen.getByRole("menuitem", { name: "Edit" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Draft with AI" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Send (HITL)" })).toHaveLength(1);
  });

  it("Save updates the own reply without sending a new parent reply", async () => {
    mockedStudioApi.getCommentInbox.mockResolvedValueOnce({
      success: true,
      comments: [
        {
          ...inboxComment,
          total_reply_count: 1,
          replies: [
            {
              comment_id: "r-own",
              author: "MyChannel",
              text: "Thanks",
              can_edit: true,
            },
          ],
        },
      ],
    });
    mockedStudioApi.updateCommentReply.mockResolvedValueOnce({
      success: true,
      comment_id: "r-own",
      text: "Thanks for watching",
    });
    renderAssistant();
    await waitFor(() => expect(screen.getByText("MyChannel")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Edit reply"), {
      target: { value: "Thanks for watching" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByText("Thanks for watching")).toBeTruthy();
    });
    expect(mockedStudioApi.updateCommentReply).toHaveBeenCalledWith({
      comment_id: "r-own",
      text: "Thanks for watching",
    });
    expect(mockedStudioApi.sendCommentReply).not.toHaveBeenCalled();
  });

  it("Cancel restores the original reply and does not call update", async () => {
    mockedStudioApi.getCommentInbox.mockResolvedValueOnce({
      success: true,
      comments: [
        {
          ...inboxComment,
          total_reply_count: 1,
          replies: [
            {
              comment_id: "r-own",
              author: "MyChannel",
              text: "Thanks",
              can_edit: true,
            },
          ],
        },
      ],
    });
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Thanks")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Edit reply"), {
      target: { value: "Changed draft" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByText("Thanks")).toBeTruthy();
    expect(screen.queryByLabelText("Edit reply")).toBeNull();
    expect(mockedStudioApi.updateCommentReply).not.toHaveBeenCalled();
  });

  it("disables Save until the reply text changes", async () => {
    mockedStudioApi.getCommentInbox.mockResolvedValueOnce({
      success: true,
      comments: [
        {
          ...inboxComment,
          total_reply_count: 1,
          replies: [
            {
              comment_id: "r-own",
              author: "MyChannel",
              text: "Thanks",
              can_edit: true,
            },
          ],
        },
      ],
    });
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Thanks")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));

    expect(screen.getByRole("button", { name: "Save" })).toHaveProperty("disabled", true);
    fireEvent.change(screen.getByLabelText("Edit reply"), {
      target: { value: "Thanks for watching" },
    });
    expect(screen.getByRole("button", { name: "Save" })).toHaveProperty("disabled", false);
  });

  it("keeps the parent comment when reply edit fails", async () => {
    mockedStudioApi.getCommentInbox.mockResolvedValueOnce({
      success: true,
      comments: [
        {
          ...inboxComment,
          total_reply_count: 1,
          replies: [
            {
              comment_id: "r-own",
              author: "MyChannel",
              text: "Thanks",
              can_edit: true,
            },
          ],
        },
      ],
    });
    mockedStudioApi.updateCommentReply.mockResolvedValueOnce({
      success: false,
      message: "YouTube would not allow that comment to be edited.",
    });
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Edit reply"), {
      target: { value: "Edited text" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(
        screen.getByText("YouTube would not allow that comment to be edited."),
      ).toBeTruthy();
    });
    expect(screen.getByText("Sam")).toBeTruthy();
    expect(screen.getByLabelText("Edit reply")).toHaveValue("Edited text");
  });

  it("does not show thrown request text when reply edit fails", async () => {
    mockedStudioApi.getCommentInbox.mockResolvedValueOnce({
      success: true,
      comments: [
        {
          ...inboxComment,
          total_reply_count: 1,
          replies: [
            {
              comment_id: "r-own",
              author: "MyChannel",
              text: "Thanks",
              can_edit: true,
            },
          ],
        },
      ],
    });
    mockedStudioApi.updateCommentReply.mockRejectedValueOnce(
      new Error("Request failed with status code 503"),
    );
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Edit reply"), {
      target: { value: "Edited text" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByText(/Could not save that edit/i)).toBeTruthy();
    });
    expect(screen.queryByText(/status code 503/i)).toBeNull();
    expect(screen.getByText("Loved the intro")).toBeTruthy();
  });

  it("Delete asks for confirmation and Cancel does not call the API", async () => {
    mockedStudioApi.getCommentInbox.mockResolvedValueOnce({
      success: true,
      comments: [
        {
          ...inboxComment,
          total_reply_count: 1,
          replies: [
            {
              comment_id: "r-own",
              author: "MyChannel",
              text: "Thanks",
              can_edit: true,
            },
          ],
        },
      ],
    });
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Thanks")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));

    expect(screen.getByText("Delete this reply?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByText("Thanks")).toBeTruthy();
    expect(screen.queryByText("Delete this reply?")).toBeNull();
    expect(mockedStudioApi.deleteCommentReply).not.toHaveBeenCalled();
    expect(screen.getAllByRole("button", { name: "Draft with AI" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Send (HITL)" })).toHaveLength(1);
  });

  it("confirm Delete removes the reply without sending a parent reply", async () => {
    mockedStudioApi.getCommentInbox.mockResolvedValueOnce({
      success: true,
      comments: [
        {
          ...inboxComment,
          total_reply_count: 1,
          replies: [
            {
              comment_id: "r-own",
              author: "MyChannel",
              text: "Thanks",
              can_edit: true,
            },
          ],
        },
      ],
    });
    mockedStudioApi.deleteCommentReply.mockResolvedValueOnce({ success: true });
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Thanks")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(screen.queryByText("Thanks")).toBeNull();
    });
    expect(mockedStudioApi.deleteCommentReply).toHaveBeenCalledWith({
      comment_id: "r-own",
    });
    expect(mockedStudioApi.sendCommentReply).not.toHaveBeenCalled();
    expect(mockedStudioApi.getCommentInbox.mock.calls.length).toBe(1);
    expect(screen.getByText("Loved the intro")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Draft with AI" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Send (HITL)" })).toHaveLength(1);
    expect(screen.queryByText("Replies")).toBeNull();
  });

  it("keeps a viewer reply when the creator deletes their own reply", async () => {
    mockedStudioApi.getCommentInbox.mockResolvedValueOnce({
      success: true,
      comments: [
        {
          ...inboxComment,
          total_reply_count: 2,
          replies: [
            {
              comment_id: "r-own",
              author: "MyChannel",
              text: "Thanks",
              can_edit: true,
            },
            {
              comment_id: "r-viewer",
              author: "Pat",
              text: "Me too",
              can_edit: false,
            },
          ],
        },
      ],
    });
    mockedStudioApi.deleteCommentReply.mockResolvedValueOnce({ success: true });
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Pat")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(screen.queryByText("Thanks")).toBeNull();
    });
    expect(screen.getByText("Me too")).toBeTruthy();
    expect(screen.getByText("1 reply")).toBeTruthy();
    expect(screen.getByText("Loved the intro")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Draft with AI" })).toHaveLength(1);
  });

  it("disables confirm actions while delete is in progress", async () => {
    mockedStudioApi.getCommentInbox.mockResolvedValueOnce({
      success: true,
      comments: [
        {
          ...inboxComment,
          total_reply_count: 1,
          replies: [
            {
              comment_id: "r-own",
              author: "MyChannel",
              text: "Thanks",
              can_edit: true,
            },
          ],
        },
      ],
    });
    let finishDelete: (value: { success: boolean }) => void = () => undefined;
    mockedStudioApi.deleteCommentReply.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishDelete = resolve;
        }),
    );
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Thanks")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(screen.getByRole("button", { name: "Delete" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveProperty("disabled", true);

    finishDelete({ success: true });
    await waitFor(() => {
      expect(screen.queryByText("Thanks")).toBeNull();
    });
  });

  it("keeps the reply and parent comment when delete fails", async () => {
    mockedStudioApi.getCommentInbox.mockResolvedValueOnce({
      success: true,
      comments: [
        {
          ...inboxComment,
          total_reply_count: 1,
          replies: [
            {
              comment_id: "r-own",
              author: "MyChannel",
              text: "Thanks",
              can_edit: true,
            },
          ],
        },
      ],
    });
    mockedStudioApi.deleteCommentReply.mockResolvedValueOnce({
      success: false,
      message: "YouTube would not delete that comment. Check comment permissions and try again.",
    });
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "YouTube would not delete that comment. Check comment permissions and try again.",
        ),
      ).toBeTruthy();
    });
    expect(screen.getByText("Thanks")).toBeTruthy();
    expect(screen.getByText("Sam")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Draft with AI" })).toHaveLength(1);
  });

  it("does not show thrown request text when reply delete fails", async () => {
    mockedStudioApi.getCommentInbox.mockResolvedValueOnce({
      success: true,
      comments: [
        {
          ...inboxComment,
          total_reply_count: 1,
          replies: [
            {
              comment_id: "r-own",
              author: "MyChannel",
              text: "Thanks",
              can_edit: true,
            },
          ],
        },
      ],
    });
    mockedStudioApi.deleteCommentReply.mockRejectedValueOnce(
      new Error("Request failed with status code 503"),
    );
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(screen.getByText(/Could not delete that reply/i)).toBeTruthy();
    });
    expect(screen.queryByText(/status code 503/i)).toBeNull();
    expect(screen.getByText("Thanks")).toBeTruthy();
    expect(screen.getByText("Loved the intro")).toBeTruthy();
  });
});
