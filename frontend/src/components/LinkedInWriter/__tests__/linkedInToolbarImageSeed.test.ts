import { buildToolbarImageSeedFromDraft } from "../utils/linkedInToolbarImageSeed";
import * as linkedInPublishFormatters from "../utils/linkedInPublishFormatters";
import {
  LINKEDIN_IMAGE_EMPTY_SEED_FALLBACK,
  LINKEDIN_IMAGE_SEED_MAX_CHARS,
} from "../../../services/linkedInImageService";

describe("linkedInToolbarImageSeed", () => {
  beforeEach(() => {
    vi.spyOn(console, "debug").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses full formatted draft text, not a 200-char slice", () => {
    const body = "Post insight ".repeat(30).trim();
    expect(body.length).toBeGreaterThan(200);

    const { seedText, prompt } = buildToolbarImageSeedFromDraft(
      `**${body}**`,
      "Future of Work",
      "Technology",
    );

    expect(seedText).toContain(body.slice(0, 300));
    expect(seedText.length).toBeGreaterThan(200);
    expect(prompt).toContain(body.slice(0, 300));
    expect(prompt).toContain("Topic: Future of Work.");
    expect(prompt).toContain("Industry: Technology.");
  });

  it("strips markdown via formatDraftForPublish before seeding", () => {
    const { seedText } = buildToolbarImageSeedFromDraft(
      "Hello **bold** world",
      undefined,
      undefined,
    );

    expect(seedText).toBe("Hello bold world");
    expect(seedText).not.toContain("**");
  });

  it("caps prompt body at LINKEDIN_IMAGE_SEED_MAX_CHARS while keeping full seedText", () => {
    const longBody = "Z".repeat(1500);
    const { seedText, prompt } = buildToolbarImageSeedFromDraft(longBody);

    expect(seedText.length).toBe(1500);
    expect(prompt).toContain("Z".repeat(LINKEDIN_IMAGE_SEED_MAX_CHARS));
    expect(prompt).not.toContain("Z".repeat(LINKEDIN_IMAGE_SEED_MAX_CHARS + 1));
  });

  it("uses fallback seed when draft is empty", () => {
    const { seedText, prompt } = buildToolbarImageSeedFromDraft("   ");

    expect(seedText).toBe(LINKEDIN_IMAGE_EMPTY_SEED_FALLBACK);
    expect(prompt).toContain(LINKEDIN_IMAGE_EMPTY_SEED_FALLBACK);
  });

  it("returns fallback on formatter failure", () => {
    const formatSpy = vi
      .spyOn(linkedInPublishFormatters, "formatDraftForPublish")
      .mockImplementation(() => {
        throw new Error("format failed");
      });

    const { seedText } = buildToolbarImageSeedFromDraft("any draft");

    expect(seedText).toBe(LINKEDIN_IMAGE_EMPTY_SEED_FALLBACK);
    expect(console.error).toHaveBeenCalled();

    formatSpy.mockRestore();
  });
});
