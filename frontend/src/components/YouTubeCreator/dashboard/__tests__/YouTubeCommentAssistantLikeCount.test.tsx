/**
 * Read-only YouTube like_count in Comment Reply Assistant. Not Like/Dislike/Heart actions.
 */
import { fireEvent, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import {
  commentWithReplies,
  expandThreadReplies,
  inboxComment,
  mockedStudioApi,
  renderAssistant,
  stubLoadedInbox,
} from "./youtubeCommentAssistantTestSetup";

describe("YouTube Comment Reply Assistant like count", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubLoadedInbox();
  });

  it("shows a read-only like count on the parent when like_count is at least 1", async () => {
    mockedStudioApi.getCommentInbox.mockResolvedValueOnce({
      success: true,
      comments: [{ ...inboxComment, like_count: 3 }],
    });
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());

    expect(screen.getByText("3 likes")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /3 likes/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Like$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Dislike$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Heart$/i })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Draft with AI" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /^Reply$/ })).toHaveLength(1);
  });

  it("omits the like count when missing or zero", async () => {
    mockedStudioApi.getCommentInbox.mockResolvedValueOnce({
      success: true,
      comments: [
        inboxComment,
        {
          ...inboxComment,
          comment_id: "c-2",
          author: "Lee",
          text: "Need a recap",
          like_count: 0,
        },
      ],
    });
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Lee")).toBeTruthy());

    expect(screen.queryByText(/likes?$/)).toBeNull();
  });

  it("shows a read-only like count on an expanded reply", async () => {
    mockedStudioApi.getCommentInbox.mockResolvedValueOnce({
      success: true,
      comments: [
        commentWithReplies([
          { comment_id: "r-1", author: "Pat", text: "Me too", like_count: 1 },
        ]),
      ],
    });
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());
    await expandThreadReplies();
    await waitFor(() => expect(screen.getByText("Pat")).toBeTruthy());

    expect(screen.getByText("1 like")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /1 like/i })).toBeNull();
  });

  it("shows a read-only like count on a Show more reply", async () => {
    mockedStudioApi.getCommentInbox.mockResolvedValueOnce({
      success: true,
      comments: [
        commentWithReplies(
          [{ comment_id: "r-1", author: "Pat", text: "Me too", like_count: 2 }],
          3,
        ),
      ],
    });
    mockedStudioApi.listCommentReplies.mockResolvedValueOnce({
      success: true,
      replies: [
        { comment_id: "r-1", author: "Pat", text: "Me too", like_count: 2 },
        { comment_id: "r-3", author: "Kim", text: "Thanks", like_count: 5 },
      ],
    });
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());
    await expandThreadReplies();
    fireEvent.click(await screen.findByRole("button", { name: "Show more replies" }));
    await waitFor(() => expect(screen.getByText("Kim")).toBeTruthy());

    expect(screen.getByText("5 likes")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /5 likes/i })).toBeNull();
    expect(screen.getByRole("button", { name: "Hide replies" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Draft with AI" })).toHaveLength(1);
  });

  it("omits a reply like count of zero", async () => {
    mockedStudioApi.getCommentInbox.mockResolvedValueOnce({
      success: true,
      comments: [
        commentWithReplies([
          { comment_id: "r-1", author: "Pat", text: "Me too", like_count: 0 },
        ]),
      ],
    });
    renderAssistant();
    await waitFor(() => expect(screen.getByText("Sam")).toBeTruthy());
    await expandThreadReplies();
    await waitFor(() => expect(screen.getByText("Pat")).toBeTruthy());

    expect(screen.queryByText(/likes?$/)).toBeNull();
  });
});
