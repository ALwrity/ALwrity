/**
 * HITL edit of the creator's own reply under a parent comment.
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

describe("YouTube Comment Reply Assistant reply edit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubLoadedInbox();
  });

  it("shows Edit overflow only on the creator's own reply", async () => {
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
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());
    await expandThreadReplies();
    await waitFor(() => expect(screen.getByText("Pat")).toBeTruthy());

    expect(screen.getAllByRole("button", { name: "More actions" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(screen.getByRole("menuitem", { name: "Edit" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Draft with AI" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /^Reply$/ })).toHaveLength(1);
  });

  it("Save updates the own reply without sending a new parent reply", async () => {
    mockedStudioApi.getCommentInbox.mockResolvedValueOnce({
      success: true,
      comments: [ownReplyInbox],
    });
    mockedStudioApi.updateCommentReply.mockResolvedValueOnce({
      success: true,
      comment_id: "r-own",
      text: "Thanks for watching",
    });
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());
    await expandThreadReplies();
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
      comments: [ownReplyInbox],
    });
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());
    await expandThreadReplies();
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
      comments: [ownReplyInbox],
    });
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());
    await expandThreadReplies();
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
      comments: [ownReplyInbox],
    });
    mockedStudioApi.updateCommentReply.mockResolvedValueOnce({
      success: false,
      message: "YouTube would not allow that comment to be edited.",
    });
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());
    await expandThreadReplies();

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
      comments: [ownReplyInbox],
    });
    mockedStudioApi.updateCommentReply.mockRejectedValueOnce(
      new Error("Request failed with status code 503"),
    );
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());
    await expandThreadReplies();

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
});
