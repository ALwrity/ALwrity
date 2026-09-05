/**
 * Comment Reply Assistant expanded group: context player vs work pane.
 */
import { fireEvent, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import {
  expandThreadReplies,
  inboxComment,
  mockedStudioApi,
  ownReplyInbox,
  renderAssistant,
  stubLoadedInbox,
} from "./youtubeCommentAssistantTestSetup";

function contextPane() {
  return document.querySelector(".yt-comment-video-group-context");
}

function workPane() {
  return document.querySelector(".yt-comment-video-group-work");
}

describe("YouTube Comment Reply Assistant video layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubLoadedInbox();
  });

  it("places the iframe in the context pane and the parent comment in the work pane", async () => {
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());

    const player = screen.getByTestId("youtube-comment-iframe-player");
    expect(contextPane()?.contains(player)).toBe(true);
    expect(workPane()?.contains(player)).toBe(false);
    expect(document.querySelector(".yt-comment-video-group-body--split")).toBeTruthy();
    expect(workPane()?.contains(screen.getByText("Sam"))).toBe(true);
    expect(workPane()?.contains(screen.getByText("Loved the intro"))).toBe(true);
    expect(contextPane()?.contains(screen.getByText("Sam"))).toBe(false);
  });

  it("keeps both comments for one video inside the work pane", async () => {
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
    await waitFor(() => expect(screen.getByText("Lee")).toBeTruthy());

    expect(screen.getAllByText("Your video")).toHaveLength(1);
    expect(workPane()?.contains(screen.getByText("Sam"))).toBe(true);
    expect(workPane()?.contains(screen.getByText("Lee"))).toBe(true);
    expect(workPane()?.contains(screen.getByText("Need a recap"))).toBe(true);
    expect(contextPane()?.contains(screen.getByText("Lee"))).toBe(false);
  });

  it("hides context and work panes when the video group is collapsed", async () => {
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());

    fireEvent.click(
      screen.getByRole("button", { name: /Rank Videos in 7 Days/i }),
    );

    await waitFor(() => {
      expect(screen.queryByText("Sam")).toBeNull();
    });
    expect(contextPane()).toBeNull();
    expect(workPane()).toBeNull();
    expect(screen.queryByTestId("youtube-comment-iframe-player")).toBeNull();
    expect(screen.getByText("Your video")).toBeTruthy();
  });

  it("still shows comments in the work pane when the video cannot be embedded", async () => {
    mockedStudioApi.getCommentInbox.mockResolvedValueOnce({
      success: true,
      comments: [
        {
          ...inboxComment,
          video_id: "vid-1",
        },
      ],
    });
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());

    expect(screen.queryByTestId("youtube-comment-iframe-player")).toBeNull();
    expect(contextPane()).toBeNull();
    expect(document.querySelector(".yt-comment-video-group-body--split")).toBeNull();
    expect(workPane()?.contains(screen.getByText("Loved the intro"))).toBe(true);
  });

  it("keeps Edit and Delete available after opening More actions in the work pane", async () => {
    mockedStudioApi.getCommentInbox.mockResolvedValueOnce({
      success: true,
      comments: [ownReplyInbox],
    });
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());
    await expandThreadReplies();
    await waitFor(() => expect(screen.getByText("Thanks")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));

    const menu = screen.getByRole("menu");
    expect(menu.parentElement).toBe(document.body);
    expect(workPane()?.contains(menu)).toBe(false);
    expect(screen.getByRole("menuitem", { name: "Edit" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeTruthy();
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
  });

  it("Escape closes More actions without closing the assistant", async () => {
    mockedStudioApi.getCommentInbox.mockResolvedValueOnce({
      success: true,
      comments: [ownReplyInbox],
    });
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());
    await expandThreadReplies();
    await waitFor(() => expect(screen.getByText("Thanks")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(screen.getByRole("menu")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("dialog", { name: "Comment Reply Assistant" })).toBeTruthy();
    expect(screen.getByText("Thanks")).toBeTruthy();
  });
});
