/**
 * Draft Cancel in Comment Reply Assistant. Progress titles stay in the progress suite.
 */
import { fireEvent, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import {
  deferred,
  mockedStudioApi,
  renderAssistant,
  rerenderAssistant,
  stubLoadedInbox,
} from "./youtubeCommentAssistantTestSetup";

describe("YouTube Comment Reply Assistant draft cancel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubLoadedInbox();
  });

  it("does not show Cancel until there is a draft or Draft with AI is running", async () => {
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
  });

  it("clears a generated draft when Cancel is clicked so Send stays unused", async () => {
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

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByPlaceholderText("Draft reply…")).toHaveValue("");
    expect(screen.getByRole("button", { name: /^Reply$/ })).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    expect(mockedStudioApi.sendCommentReply).not.toHaveBeenCalled();
    expect(screen.getByText("Loved the intro")).toBeTruthy();
  });

  it("Cancel during Draft with AI hides the panel and ignores a late draft", async () => {
    const pending = deferred<{ success: boolean; draft: string }>();
    mockedStudioApi.draftCommentReply.mockReturnValueOnce(pending.promise);
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Draft with AI" }));
    expect(screen.getByRole("status")).toHaveTextContent("Drafting reply");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveProperty(
      "disabled",
      false,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByPlaceholderText("Draft reply…")).toHaveValue("");

    pending.resolve({
      success: true,
      draft: "Thanks for watching — what did you try first?",
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Draft with AI" })).toHaveProperty(
        "disabled",
        false,
      );
    });
    expect(screen.getByPlaceholderText("Draft reply…")).toHaveValue("");
    expect(screen.queryByText(/Could not draft a reply/i)).toBeNull();
  });

  it("aborts the in-flight draft request when Cancel is clicked", async () => {
    const pending = deferred<{ success: boolean; draft: string }>();
    let draftSignal: AbortSignal | undefined;
    mockedStudioApi.draftCommentReply.mockImplementationOnce((_body, options) => {
      draftSignal = options?.signal;
      return pending.promise;
    });
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Draft with AI" }));
    expect(draftSignal?.aborted).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(draftSignal?.aborted).toBe(true);
    pending.resolve({ success: true, draft: "Should be ignored" });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Draft with AI" })).toHaveProperty(
        "disabled",
        false,
      );
    });
    expect(screen.getByPlaceholderText("Draft reply…")).toHaveValue("");
  });

  it("clears a typed draft without calling send or draft APIs", async () => {
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());
    fireEvent.change(screen.getByPlaceholderText("Draft reply…"), {
      target: { value: "Thanks for watching" },
    });
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByPlaceholderText("Draft reply…")).toHaveValue("");
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    expect(mockedStudioApi.draftCommentReply).not.toHaveBeenCalled();
    expect(mockedStudioApi.sendCommentReply).not.toHaveBeenCalled();
  });

  it("disables Cancel while Send is in flight so the send request is not aborted", async () => {
    const pending = deferred<{ success: boolean; message: string }>();
    mockedStudioApi.sendCommentReply.mockReturnValueOnce(pending.promise);
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());
    fireEvent.change(screen.getByPlaceholderText("Draft reply…"), {
      target: { value: "Thanks for watching" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Reply$/ }));

    expect(screen.getByRole("button", { name: "Cancel" })).toHaveProperty("disabled", true);

    pending.resolve({ success: true, message: "Reply published." });
    await waitFor(() => {
      expect(screen.getByText("Reply published.")).toBeTruthy();
    });
    expect(mockedStudioApi.sendCommentReply).toHaveBeenCalledTimes(1);
  });

  it("ignores a late draft after the modal is closed", async () => {
    const pending = deferred<{ success: boolean; draft: string }>();
    let draftSignal: AbortSignal | undefined;
    mockedStudioApi.draftCommentReply.mockImplementationOnce((_body, options) => {
      draftSignal = options?.signal;
      return pending.promise;
    });
    const { rerender } = renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Draft with AI" }));

    rerenderAssistant(rerender, false);

    expect(draftSignal?.aborted).toBe(true);
    pending.resolve({
      success: true,
      draft: "Thanks for watching — what did you try first?",
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Comment Reply Assistant" })).toBeNull();
    });
    expect(screen.queryByPlaceholderText("Draft reply…")).toBeNull();
  });
});
