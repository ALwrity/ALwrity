/**
 * HITL delete of the creator's own reply under a parent comment.
 */
import { fireEvent, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import {
  commentWithReplies,
  expandThreadReplies,
  mockedStudioApi,
  ownReply,
  ownReplyInbox,
  renderAssistant,
  stubLoadedInbox,
} from "./youtubeCommentAssistantTestSetup";

describe("YouTube Comment Reply Assistant reply delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubLoadedInbox();
  });

  it("Delete asks for confirmation and Cancel does not call the API", async () => {
    mockedStudioApi.getCommentInbox.mockResolvedValueOnce({
      success: true,
      comments: [ownReplyInbox],
    });
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());
    await expandThreadReplies();
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
      comments: [ownReplyInbox],
    });
    mockedStudioApi.deleteCommentReply.mockResolvedValueOnce({ success: true });
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());
    await expandThreadReplies();
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
        commentWithReplies(
          [
            ownReply,
            { comment_id: "r-viewer", author: "Pat", text: "Me too", can_edit: false },
          ],
          2,
        ),
      ],
    });
    mockedStudioApi.deleteCommentReply.mockResolvedValueOnce({ success: true });
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());
    await expandThreadReplies();
    await waitFor(() => expect(screen.getByText("Pat")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(screen.queryByText("Thanks")).toBeNull();
    });
    expect(screen.getByText("Me too")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Hide replies" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "1 reply" })).toBeNull();
    expect(screen.getByText("Loved the intro")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Draft with AI" })).toHaveLength(1);
  });

  it("disables confirm actions while delete is in progress", async () => {
    mockedStudioApi.getCommentInbox.mockResolvedValueOnce({
      success: true,
      comments: [ownReplyInbox],
    });
    let finishDelete: (value: { success: boolean }) => void = () => undefined;
    mockedStudioApi.deleteCommentReply.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishDelete = resolve;
        }),
    );
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());
    await expandThreadReplies();
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
      comments: [ownReplyInbox],
    });
    mockedStudioApi.deleteCommentReply.mockResolvedValueOnce({
      success: false,
      message:
        "YouTube would not delete that comment. Check comment permissions and try again.",
    });
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());
    await expandThreadReplies();

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
      comments: [ownReplyInbox],
    });
    mockedStudioApi.deleteCommentReply.mockRejectedValueOnce(
      new Error("Request failed with status code 503"),
    );
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());
    await expandThreadReplies();

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
