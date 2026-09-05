/**
 * Per-action progress in Comment Reply Assistant. HITL and APIs stay unchanged.
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { YouTubeCommentActionProgressPanel } from "../YouTubeCommentActionProgressPanel";
import {
  deferred,
  expandThreadReplies,
  inboxComment,
  mockedStudioApi,
  ownReplyInbox,
  renderAssistant,
  stubLoadedInbox,
} from "./youtubeCommentAssistantTestSetup";

describe("YouTube Comment Reply Assistant action progress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubLoadedInbox();
  });

  it("shows Drafting reply until the draft fills the box", async () => {
    const pending = deferred<{ success: boolean; draft: string }>();
    mockedStudioApi.draftCommentReply.mockReturnValueOnce(pending.promise);
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "Draft with AI" }));

    expect(screen.getByRole("status")).toHaveTextContent("Drafting reply");
    expect(screen.getByRole("button", { name: "Draft with AI" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByRole("button", { name: "Send (HITL)" })).toHaveProperty(
      "disabled",
      true,
    );

    pending.resolve({
      success: true,
      draft: "Thanks for watching — what did you try first?",
    });
    await waitFor(() => {
      expect(screen.queryByRole("status")).toBeNull();
    });
    expect(screen.getByPlaceholderText("Draft reply…")).toHaveValue(
      "Thanks for watching — what did you try first?",
    );
  });

  it("shows Sending reply while send is in flight and keeps the parent comment", async () => {
    const pending = deferred<{ success: boolean; message: string }>();
    mockedStudioApi.sendCommentReply.mockReturnValueOnce(pending.promise);
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());
    fireEvent.change(screen.getByPlaceholderText("Draft reply…"), {
      target: { value: "Thanks for watching" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send (HITL)" }));

    expect(screen.getByRole("status")).toHaveTextContent("Sending reply");
    expect(screen.getByText("Loved the intro")).toBeTruthy();

    pending.resolve({ success: true, message: "Reply published." });
    await waitFor(() => {
      expect(screen.getByText("Reply published.")).toBeTruthy();
    });
    expect(screen.queryByText("Sending reply")).toBeNull();
  });

  it("hides the draft panel and shows the user-safe error when draft fails", async () => {
    const pending = deferred<{ success: boolean; message: string }>();
    mockedStudioApi.draftCommentReply.mockReturnValueOnce(pending.promise);
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Draft with AI" }));
    expect(screen.getByRole("status")).toHaveTextContent("Drafting reply");

    pending.resolve({
      success: false,
      message: "Could not draft a reply. Try again.",
    });
    await waitFor(() => {
      expect(screen.getByText("Could not draft a reply. Try again.")).toBeTruthy();
    });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows Saving edit while save is in flight", async () => {
    mockedStudioApi.getCommentInbox.mockResolvedValueOnce({
      success: true,
      comments: [ownReplyInbox],
    });
    const pending = deferred<{ success: boolean; text: string }>();
    mockedStudioApi.updateCommentReply.mockReturnValueOnce(pending.promise);
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());
    await expandThreadReplies();
    await waitFor(() => expect(screen.getByText("Thanks")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Edit reply"), {
      target: { value: "Thanks for watching" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("status")).toHaveTextContent("Saving edit");

    pending.resolve({ success: true, text: "Thanks for watching" });
    await waitFor(() => {
      expect(screen.getByText("Thanks for watching")).toBeTruthy();
    });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("does not show Deleting reply until confirm Delete, then hides after success", async () => {
    mockedStudioApi.getCommentInbox.mockResolvedValueOnce({
      success: true,
      comments: [ownReplyInbox],
    });
    const pending = deferred<{ success: boolean }>();
    mockedStudioApi.deleteCommentReply.mockReturnValueOnce(pending.promise);
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());
    await expandThreadReplies();
    await waitFor(() => expect(screen.getByText("Thanks")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(screen.getByText("Delete this reply?")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("status")).toHaveTextContent("Deleting reply");

    pending.resolve({ success: true });
    await waitFor(() => {
      expect(screen.queryByText("Thanks")).toBeNull();
    });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("hides the delete panel and keeps the reply when delete fails", async () => {
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
    await waitFor(() => expect(screen.getByText("Thanks")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(screen.getByText(/Could not delete that reply/i)).toBeTruthy();
    });
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByText(/status code 503/i)).toBeNull();
    expect(screen.getByText("Thanks")).toBeTruthy();
  });

  it("hides Sending reply and keeps HITL draft when send throws", async () => {
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
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByText(/status code 503/i)).toBeNull();
    expect(screen.getByPlaceholderText("Draft reply…")).toHaveValue("Thanks for watching");
    expect(screen.getByText("Loved the intro")).toBeTruthy();
  });

  it("hides Saving edit and keeps the editor when save fails", async () => {
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
    await waitFor(() => expect(screen.getByText("Thanks")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Edit reply"), {
      target: { value: "Thanks for watching" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByText(/Could not save that edit/i)).toBeTruthy();
    });
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByLabelText("Edit reply")).toHaveValue("Thanks for watching");
    expect(screen.queryByText(/status code 503/i)).toBeNull();
  });

  it("shows Drafting reply only on the busy parent card", async () => {
    const pending = deferred<{ success: boolean; draft: string }>();
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
    mockedStudioApi.draftCommentReply.mockReturnValueOnce(pending.promise);
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Lee")).toBeTruthy());

    fireEvent.click(screen.getAllByRole("button", { name: "Draft with AI" })[0]);

    expect(screen.getByRole("status")).toHaveTextContent("Drafting reply");
    expect(screen.getByText(/typical steps/i)).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Draft with AI" })[0]).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getAllByRole("button", { name: "Draft with AI" })[1]).toHaveProperty(
      "disabled",
      false,
    );
    expect(mockedStudioApi.sendCommentReply).not.toHaveBeenCalled();

    pending.resolve({ success: true, draft: "Glad it helped." });
    await waitFor(() => {
      expect(screen.queryByRole("status")).toBeNull();
    });
  });
});

describe("YouTubeCommentActionProgressPanel", () => {
  it("logs start and stop without comment identifiers", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const { unmount } = render(<YouTubeCommentActionProgressPanel action="delete" />);

    expect(screen.getByRole("status")).toHaveTextContent("Deleting reply");
    expect(screen.getByText(/typical steps/i)).toBeTruthy();
    const started = info.mock.calls.map((call) => JSON.stringify(call)).join(" ");
    expect(started).toMatch(/Status started/);
    expect(started.toLowerCase()).not.toMatch(/comment_id|r-own|c-1/);

    unmount();
    const all = info.mock.calls.map((call) => JSON.stringify(call)).join(" ");
    expect(all).toMatch(/Status stopped/);
    info.mockRestore();
  });
});
