/**
 * Collapsed inlined replies expander. Empty snippet counts must not invent Show more.
 */
import { fireEvent, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import {
  commentWithReplies,
  expandThreadReplies,
  mockedStudioApi,
  renderAssistant,
  stubLoadedInbox,
} from "./youtubeCommentAssistantTestSetup";

describe("YouTube Comment Reply Assistant replies expander", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubLoadedInbox();
  });

  it("starts inlined replies collapsed and expands without an API call", async () => {
    mockedStudioApi.getCommentInbox.mockResolvedValueOnce({
      success: true,
      comments: [
        commentWithReplies([
          { comment_id: "r-1", author: "Pat", text: "Me too" },
          { comment_id: "r-2", author: "Lee", text: "Same here" },
        ]),
      ],
    });
    renderAssistant();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "2 replies" })).toBeTruthy();
    });
    expect(screen.queryByText("Pat")).toBeNull();
    expect(screen.queryByText("Lee")).toBeNull();
    await expandThreadReplies();
    expect(screen.getByText("Pat")).toBeTruthy();
    expect(screen.getByText("Me too")).toBeTruthy();
    expect(screen.getByText("Lee")).toBeTruthy();
    expect(screen.getByText("Same here")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Hide replies" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "2 replies" })).toBeNull();
    expect(mockedStudioApi.listCommentReplies).not.toHaveBeenCalled();
    expect(screen.getAllByRole("button", { name: "Draft with AI" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /^Reply$/ })).toHaveLength(1);
  });

  it("Hide replies collapses the thread without an API call", async () => {
    mockedStudioApi.getCommentInbox.mockResolvedValueOnce({
      success: true,
      comments: [
        commentWithReplies([
          { comment_id: "r-1", author: "Pat", text: "Me too" },
        ]),
      ],
    });
    renderAssistant();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "1 reply" })).toBeTruthy();
    });
    await expandThreadReplies();
    expect(screen.getByText("Pat")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Hide replies" }));

    expect(screen.queryByText("Pat")).toBeNull();
    expect(screen.getByRole("button", { name: "1 reply" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Hide replies" })).toBeNull();
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

  it("does not show a reply expander when total_reply_count is stale and no replies were inlined", async () => {
    mockedStudioApi.getCommentInbox.mockResolvedValueOnce({
      success: true,
      comments: [commentWithReplies([], 1)],
    });
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());

    expect(screen.queryByRole("button", { name: "1 reply" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Show more replies" })).toBeNull();
    expect(screen.queryByText("Replies")).toBeNull();
    expect(mockedStudioApi.listCommentReplies).not.toHaveBeenCalled();
  });

  it("does not invent a reply expander when YouTube reported a count but inlined no replies", async () => {
    mockedStudioApi.getCommentInbox.mockResolvedValueOnce({
      success: true,
      comments: [commentWithReplies([], 6)],
    });
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());

    expect(screen.queryByRole("button", { name: "Show more replies" })).toBeNull();
    expect(screen.queryByRole("button", { name: "6 replies" })).toBeNull();
    expect(mockedStudioApi.listCommentReplies).not.toHaveBeenCalled();
  });

  it("Show more replies loads extra rows after the thread is expanded", async () => {
    mockedStudioApi.getCommentInbox.mockResolvedValueOnce({
      success: true,
      comments: [
        commentWithReplies(
          [{ comment_id: "r-1", author: "Pat", text: "Me too" }],
          3,
        ),
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
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());
    await expandThreadReplies();
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
    expect(screen.getByRole("button", { name: "Hide replies" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Hide replies" }));

    expect(screen.queryByText("Kim")).toBeNull();
    expect(screen.getByRole("button", { name: "3 replies" })).toBeTruthy();
  });

  it("shows a user-safe Show more error and keeps the parent comment", async () => {
    mockedStudioApi.getCommentInbox.mockResolvedValueOnce({
      success: true,
      comments: [
        commentWithReplies(
          [{ comment_id: "r-1", author: "Pat", text: "Me too" }],
          8,
        ),
      ],
    });
    mockedStudioApi.listCommentReplies.mockResolvedValueOnce({
      success: false,
      message: "That comment could not be found. It may have been removed.",
    });
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());
    await expandThreadReplies();

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
        commentWithReplies(
          [{ comment_id: "r-1", author: "Pat", text: "Me too" }],
          8,
        ),
      ],
    });
    mockedStudioApi.listCommentReplies.mockRejectedValueOnce(
      new Error("Request failed with status code 500"),
    );
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());
    await expandThreadReplies();

    fireEvent.click(screen.getByRole("button", { name: "Show more replies" }));

    await waitFor(() => {
      expect(screen.getByText(/Could not load replies/i)).toBeTruthy();
    });
    expect(screen.queryByText(/status code 500/i)).toBeNull();
    expect(screen.getByText("Sam")).toBeTruthy();
  });
});
