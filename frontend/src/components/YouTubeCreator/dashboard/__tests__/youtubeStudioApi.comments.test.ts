/**
 * Existing YouTube Comment Reply Assistant client methods.
 * Hub wedge and Podcast Maker are out of scope.
 */
import { youtubeStudioApi } from "../../../../services/youtubeStudioApi";
import { apiClient } from "../../../../api/client";

vi.mock("../../../../api/client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("youtubeStudioApi comment assistant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads comment inbox from GET /api/youtube/comments/inbox", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        success: true,
        comments: [
          {
            comment_id: "c-1",
            video_id: "vid-1",
            author: "Sam",
            text: "Loved the intro",
          },
        ],
      },
    });

    const result = await youtubeStudioApi.getCommentInbox({ max_results: 20 });

    expect(apiClient.get).toHaveBeenCalledWith("/api/youtube/comments/inbox", {
      params: { max_results: 20 },
    });
    expect(result.success).toBe(true);
    expect(result.comments[0].video_id).toBe("vid-1");
    expect(result.comments[0].author).toBe("Sam");
  });

  it("forwards optional video_title on draft-reply", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { success: true, draft: "Thanks for watching." },
    });

    await youtubeStudioApi.draftCommentReply({
      comment_text: "How do I start?",
      channel_niche: "seo",
      video_title: "Rank Videos in 7 Days",
    });

    expect(apiClient.post).toHaveBeenCalledWith("/api/youtube/comments/draft-reply", {
      comment_text: "How do I start?",
      channel_niche: "seo",
      video_title: "Rank Videos in 7 Days",
    });
  });

  it("drafts a HITL reply via POST /api/youtube/comments/draft-reply", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { success: true, draft: "Thanks for watching." },
    });

    const result = await youtubeStudioApi.draftCommentReply({
      comment_text: "How do I start?",
      channel_niche: "seo",
    });

    expect(apiClient.post).toHaveBeenCalledWith("/api/youtube/comments/draft-reply", {
      comment_text: "How do I start?",
      channel_niche: "seo",
    });
    expect(result.draft).toBe("Thanks for watching.");
  });

  it("sends an approved reply via POST /api/youtube/comments/reply", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { success: true, comment_id: "reply-9", message: "Reply published." },
    });

    const result = await youtubeStudioApi.sendCommentReply({
      parent_id: "c-1",
      text: "Thanks for watching",
    });

    expect(apiClient.post).toHaveBeenCalledWith("/api/youtube/comments/reply", {
      parent_id: "c-1",
      text: "Thanks for watching",
    });
    expect(result.comment_id).toBe("reply-9");
  });

  it("loads extra replies from GET /api/youtube/comments/replies with parent_id", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        success: true,
        replies: [{ comment_id: "r-3", author: "Kim", text: "Thanks" }],
      },
    });

    const result = await youtubeStudioApi.listCommentReplies({
      parent_id: "c-1",
      max_results: 20,
    });

    expect(apiClient.get).toHaveBeenCalledWith("/api/youtube/comments/replies", {
      params: { parent_id: "c-1", max_results: 20 },
    });
    expect(result.success).toBe(true);
    expect(result.replies[0].author).toBe("Kim");
  });

  it("omits optional listCommentReplies params when unset", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { success: true, replies: [] },
    });

    await youtubeStudioApi.listCommentReplies({ parent_id: "c-1" });

    expect(apiClient.get).toHaveBeenCalledWith("/api/youtube/comments/replies", {
      params: { parent_id: "c-1" },
    });
  });

  it("updates an approved reply via PUT /api/youtube/comments/update", async () => {
    vi.mocked(apiClient.put).mockResolvedValueOnce({
      data: {
        success: true,
        comment_id: "r-own",
        text: "Thanks for watching",
      },
    });

    const result = await youtubeStudioApi.updateCommentReply({
      comment_id: "r-own",
      text: "Thanks for watching",
    });

    expect(apiClient.put).toHaveBeenCalledWith("/api/youtube/comments/update", {
      comment_id: "r-own",
      text: "Thanks for watching",
    });
    expect(result.comment_id).toBe("r-own");
    expect(result.text).toBe("Thanks for watching");
  });

  it("deletes an approved reply via DELETE /api/youtube/comments/delete", async () => {
    vi.mocked(apiClient.delete).mockResolvedValueOnce({
      data: { success: true },
    });

    const result = await youtubeStudioApi.deleteCommentReply({
      comment_id: "r-own",
    });

    expect(apiClient.delete).toHaveBeenCalledWith("/api/youtube/comments/delete", {
      params: { comment_id: "r-own" },
    });
    expect(result.success).toBe(true);
  });

  it("forwards optional token_id on comment delete", async () => {
    vi.mocked(apiClient.delete).mockResolvedValueOnce({
      data: { success: true },
    });

    await youtubeStudioApi.deleteCommentReply({
      comment_id: "r-own",
      token_id: 3,
    });

    expect(apiClient.delete).toHaveBeenCalledWith("/api/youtube/comments/delete", {
      params: { comment_id: "r-own", token_id: 3 },
    });
  });
});
