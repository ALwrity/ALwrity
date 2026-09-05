/**
 * Comment Reply Assistant HITL draft and send on the parent card.
 */
import { fireEvent, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import {
  inboxComment,
  mockedStudioApi,
  renderAssistant,
  stubLoadedInbox,
} from "./youtubeCommentAssistantTestSetup";

describe("YouTube Comment Reply Assistant draft and send", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubLoadedInbox();
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
      expect(mockedStudioApi.draftCommentReply).toHaveBeenCalledWith(
        {
          comment_text: "Need a recap",
          channel_niche: "seo",
          video_title: "Rank Videos in 7 Days",
        },
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
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
    expect(mockedStudioApi.draftCommentReply).toHaveBeenCalledWith(
      {
        comment_text: "Loved the intro",
        channel_niche: "seo",
        video_title: "Rank Videos in 7 Days",
      },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
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
