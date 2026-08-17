import { dispatchLinkedInDraftUpdate } from "../utils/linkedInDraftContentTypeStorage";
import {
  openDraftAssetInStudio,
  openDraftContentInStudio,
} from "../utils/openDraftInStudio";
import type { LinkedInDraftAsset } from "../utils/linkedInDraftLibraryUtils";

jest.mock("../utils/linkedInDraftContentTypeStorage", () => ({
  dispatchLinkedInDraftUpdate: jest.fn(),
}));

const articleAsset: LinkedInDraftAsset = {
  id: "1",
  title: "Enterprise AI Playbook",
  description: "",
  created_at: "2026-08-01T00:00:00Z",
  source_module: "linkedin_writer",
  asset_type: "text",
  tags: ["linkedin_article"],
  asset_metadata: {
    content_type: "linkedin_article",
    content: "Long article body ".repeat(20),
    word_count: 80,
  },
};

describe("openDraftInStudio", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("dispatches content and contentType for asset drafts", () => {
    openDraftAssetInStudio(articleAsset, jest.fn());

    expect(dispatchLinkedInDraftUpdate).toHaveBeenCalledWith(
      expect.stringContaining("Long article body"),
      "article",
    );
  });

  it("dispatches contentType when opening plain content", () => {
    openDraftContentInStudio("Hello world", "carousel");

    expect(dispatchLinkedInDraftUpdate).toHaveBeenCalledWith(
      "Hello world",
      "carousel",
    );
  });
});
