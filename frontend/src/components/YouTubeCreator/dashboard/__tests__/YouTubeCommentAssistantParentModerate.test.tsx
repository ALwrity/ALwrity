/**
 * HITL parent Hide comment / Hide user. Official setModerationStatus only.
 * Not Pin, Report, or comments.delete on viewer parents.
 */
import { fireEvent, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import {
  deferred,
  inboxComment,
  mockedStudioApi,
  renderAssistant,
  stubLoadedInbox,
} from "./youtubeCommentAssistantTestSetup";

function openParentMoreActions() {
  fireEvent.click(screen.getByRole("button", { name: "More comment actions" }));
}

describe("YouTube Comment Reply Assistant parent moderate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubLoadedInbox();
  });

  it("shows Hide comment and Hide user, not Pin or Report", async () => {
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());
    openParentMoreActions();

    expect(screen.getByRole("menuitem", { name: "Hide comment" })).toBeTruthy();
    expect(
      screen.getByRole("menuitem", { name: "Hide user from channel" }),
    ).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: /^Pin$/i })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: /^Report$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Like$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Dislike$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Heart$/i })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Draft with AI" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /^Reply$/ })).toHaveLength(1);
  });

  it("Hide comment asks for confirmation and Cancel does not call the API", async () => {
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());
    openParentMoreActions();
    fireEvent.click(screen.getByRole("menuitem", { name: "Hide comment" }));

    expect(
      screen.getByText(
        "Hide this comment? It and its replies will no longer show on the video.",
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByText("Loved the intro")).toBeTruthy();
    expect(
      screen.queryByText(
        "Hide this comment? It and its replies will no longer show on the video.",
      ),
    ).toBeNull();
    expect(mockedStudioApi.setCommentModerationStatus).not.toHaveBeenCalled();
    expect(mockedStudioApi.deleteCommentReply).not.toHaveBeenCalled();
    expect(screen.getAllByRole("button", { name: "Draft with AI" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /^Reply$/ })).toHaveLength(1);
  });

  it("confirm Hide comment drops the parent without delete or send", async () => {
    mockedStudioApi.setCommentModerationStatus.mockResolvedValueOnce({
      success: true,
      message: "Comment hidden.",
    });
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());
    openParentMoreActions();
    fireEvent.click(screen.getByRole("menuitem", { name: "Hide comment" }));
    fireEvent.click(screen.getByRole("button", { name: "Hide comment" }));

    await waitFor(() => {
      expect(screen.queryByText("Loved the intro")).toBeNull();
    });
    expect(mockedStudioApi.setCommentModerationStatus).toHaveBeenCalledWith({
      comment_id: "c-1",
      ban_author: false,
    });
    expect(mockedStudioApi.deleteCommentReply).not.toHaveBeenCalled();
    expect(mockedStudioApi.sendCommentReply).not.toHaveBeenCalled();
    expect(mockedStudioApi.getCommentInbox.mock.calls.length).toBe(1);
    expect(screen.getByText("Comment hidden.")).toBeTruthy();
  });

  it("Hide user confirm explains auto-reject and calls ban_author true", async () => {
    mockedStudioApi.setCommentModerationStatus.mockResolvedValueOnce({
      success: true,
      message: "User hidden from the channel.",
    });
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());
    openParentMoreActions();
    fireEvent.click(screen.getByRole("menuitem", { name: "Hide user from channel" }));

    expect(
      screen.getByText(
        /removed and future comments from this author are auto-rejected/i,
      ),
    ).toBeTruthy();
    expect(screen.getByText(/cannot undo/i)).toBeTruthy();
    expect(screen.getByText(/Studio Community/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hide user from channel" }));

    await waitFor(() => {
      expect(screen.queryByText("Loved the intro")).toBeNull();
    });
    expect(mockedStudioApi.setCommentModerationStatus).toHaveBeenCalledWith({
      comment_id: "c-1",
      ban_author: true,
    });
    expect(mockedStudioApi.deleteCommentReply).not.toHaveBeenCalled();
  });

  it("keeps the parent when hide fails and Draft still works", async () => {
    mockedStudioApi.setCommentModerationStatus.mockResolvedValueOnce({
      success: false,
      message:
        "YouTube would not hide that comment. Check comment permissions and try again.",
    });
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());
    openParentMoreActions();
    fireEvent.click(screen.getByRole("menuitem", { name: "Hide comment" }));
    fireEvent.click(screen.getByRole("button", { name: "Hide comment" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "YouTube would not hide that comment. Check comment permissions and try again.",
        ),
      ).toBeTruthy();
    });
    expect(screen.getByText("Loved the intro")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Draft with AI" })).toHaveLength(1);
  });

  it("does not show thrown request text when hide fails", async () => {
    mockedStudioApi.setCommentModerationStatus.mockRejectedValueOnce(
      new Error("Request failed with status code 503"),
    );
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());
    openParentMoreActions();
    fireEvent.click(screen.getByRole("menuitem", { name: "Hide comment" }));
    fireEvent.click(screen.getByRole("button", { name: "Hide comment" }));

    await waitFor(() => {
      expect(screen.getByText(/Could not hide that comment/i)).toBeTruthy();
    });
    expect(screen.queryByText(/status code 503/i)).toBeNull();
    expect(screen.getByText("Loved the intro")).toBeTruthy();
  });

  it("shows Hiding comment while hide is in flight", async () => {
    const pending = deferred<{ success: boolean; message: string }>();
    mockedStudioApi.setCommentModerationStatus.mockReturnValueOnce(pending.promise);
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());
    openParentMoreActions();
    fireEvent.click(screen.getByRole("menuitem", { name: "Hide comment" }));
    fireEvent.click(screen.getByRole("button", { name: "Hide comment" }));

    expect(screen.getByRole("status")).toHaveTextContent("Hiding comment");
    expect(screen.getByRole("button", { name: "Hide comment" })).toHaveProperty(
      "disabled",
      true,
    );

    pending.resolve({ success: true, message: "Comment hidden." });
    await waitFor(() => {
      expect(screen.queryByText("Loved the intro")).toBeNull();
    });
  });

  it("omits Hide user on the creator's own parent comment", async () => {
    mockedStudioApi.getCommentInbox.mockResolvedValueOnce({
      success: true,
      comments: [{ ...inboxComment, can_hide_user: false }],
    });
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());
    openParentMoreActions();

    expect(screen.getByRole("menuitem", { name: "Hide comment" })).toBeTruthy();
    expect(
      screen.queryByRole("menuitem", { name: "Hide user from channel" }),
    ).toBeNull();
  });

  it("shows Hiding user from channel while hide user is in flight", async () => {
    const pending = deferred<{ success: boolean; message: string }>();
    mockedStudioApi.setCommentModerationStatus.mockReturnValueOnce(pending.promise);
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());
    openParentMoreActions();
    fireEvent.click(screen.getByRole("menuitem", { name: "Hide user from channel" }));
    fireEvent.click(screen.getByRole("button", { name: "Hide user from channel" }));

    expect(screen.getByRole("status")).toHaveTextContent("Hiding user from channel");
    expect(
      screen.getByRole("button", { name: "Hide user from channel" }),
    ).toHaveProperty("disabled", true);

    pending.resolve({ success: true, message: "User hidden from the channel." });
    await waitFor(() => {
      expect(screen.queryByText("Loved the intro")).toBeNull();
    });
    expect(mockedStudioApi.getCommentInbox.mock.calls.length).toBe(1);
  });

  it("disables parent overflow while Draft with AI is in flight", async () => {
    const pending = deferred<{ success: boolean; draft: string }>();
    mockedStudioApi.draftCommentReply.mockReturnValueOnce(pending.promise);
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Draft with AI" }));

    expect(
      screen.getByRole("button", { name: "More comment actions" }),
    ).toHaveProperty("disabled", true);

    pending.resolve({ success: true, draft: "Thanks for watching." });
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Draft reply…")).toHaveValue(
        "Thanks for watching.",
      );
    });
    expect(
      screen.getByRole("button", { name: "More comment actions" }),
    ).toHaveProperty("disabled", false);
  });
});
