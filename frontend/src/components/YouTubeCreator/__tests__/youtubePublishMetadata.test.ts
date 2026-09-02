/**
 * Combined-video publish metadata: title, description, keywords-as-tags, category.
 * Helper lives in components/; this file is the TDD spec for it.
 */
import type { Scene, VideoPlan } from "../../../services/youtubeApi";
import {
  buildYouTubePublishMetadata,
  parseYouTubePublishTags,
  reconcileYouTubePublishMetadata,
  resolveYouTubePublishVideoUrl,
  YOUTUBE_DEFAULT_PUBLISH_CATEGORY_ID,
  YOUTUBE_PUBLISH_CATEGORIES,
  type YouTubePublishMetadata,
} from "../components/youtubePublishMetadata";

const scene = (title: string): Scene => ({
  scene_number: 1,
  title,
  narration: "Narration",
  visual_prompt: "Visual",
  duration_estimate: 5,
  visual_cues: [],
  emphasis_tags: [],
});

const plan = (overrides: Partial<VideoPlan> = {}): VideoPlan => ({
  video_summary: "How to rank YouTube videos fast",
  target_audience: "Creators",
  key_message: "Use searchable titles and retention hooks.",
  content_outline: [],
  hook_strategy: "Open with a bold promise",
  visual_style: "Modern",
  seo_keywords: ["youtube seo", "retention"],
  duration_type: "medium",
  ...overrides,
});

describe("YOUTUBE_PUBLISH_CATEGORIES", () => {
  it("defaults to People & Blogs (22)", () => {
    expect(YOUTUBE_DEFAULT_PUBLISH_CATEGORY_ID).toBe("22");
    expect(
      YOUTUBE_PUBLISH_CATEGORIES.some(
        (item) => item.id === "22" && item.label === "People & Blogs",
      ),
    ).toBe(true);
  });

  it("includes Education (27) and Science & Technology (28)", () => {
    const ids = YOUTUBE_PUBLISH_CATEGORIES.map((item) => item.id);
    expect(ids).toContain("27");
    expect(ids).toContain("28");
  });
});

describe("buildYouTubePublishMetadata", () => {
  it("uses selected_title, key_message, and seo_keywords", () => {
    expect(
      buildYouTubePublishMetadata(plan({ selected_title: "Rank Videos in 7 Days" }), [
        scene("Intro"),
      ]),
    ).toEqual({
      title: "Rank Videos in 7 Days",
      description: "Use searchable titles and retention hooks.",
      tags: ["youtube seo", "retention"],
      category_id: "22",
    });
  });

  it("falls back to video_summary, then first scene title", () => {
    expect(buildYouTubePublishMetadata(plan(), [scene("Intro")]).title).toBe(
      "How to rank YouTube videos fast",
    );
    const noPlan = buildYouTubePublishMetadata(null, [scene("Intro to YouTube SEO")]);
    expect(noPlan.title).toBe("Intro to YouTube SEO");
    expect(noPlan.description).toBe("Created with ALwrity YouTube Creator");
    expect(noPlan.tags).toEqual([]);
  });

  it("does not invent tags when seo_keywords is empty", () => {
    expect(buildYouTubePublishMetadata(plan({ seo_keywords: [] }), [scene("Intro")]).tags).toEqual(
      [],
    );
  });

  it("caps title at 100 characters", () => {
    expect(
      buildYouTubePublishMetadata(plan({ selected_title: "T".repeat(140) }), []).title,
    ).toHaveLength(100);
  });

  it("uses a dated fallback title when plan and scenes have none", () => {
    expect(buildYouTubePublishMetadata(null, []).title).toMatch(/^ALwrity Video \d{4}-\d{2}-\d{2}$/);
  });
});

describe("reconcileYouTubePublishMetadata", () => {
  const previous: YouTubePublishMetadata = {
    title: "Plan Title",
    description: "Plan description",
    tags: ["youtube seo", "retention"],
    category_id: "22",
  };

  it("applies the next plan values when the user has not edited", () => {
    const next: YouTubePublishMetadata = {
      title: "New Plan Title",
      description: "New plan description",
      tags: ["ai video", "ranking"],
      category_id: "22",
    };
    expect(reconcileYouTubePublishMetadata(previous, previous, next)).toEqual(next);
  });

  it("keeps an edited title and still applies unedited plan fields", () => {
    const current: YouTubePublishMetadata = { ...previous, title: "My edited title" };
    const next: YouTubePublishMetadata = {
      title: "New Plan Title",
      description: "New plan description",
      tags: ["ai video"],
      category_id: "22",
    };
    expect(reconcileYouTubePublishMetadata(current, previous, next)).toEqual({
      title: "My edited title",
      description: "New plan description",
      tags: ["ai video"],
      category_id: "22",
    });
  });

  it("keeps edited tags and category when the plan rebuilds", () => {
    const current: YouTubePublishMetadata = {
      ...previous,
      tags: ["seo", "ranking"],
      category_id: "27",
    };
    const next: YouTubePublishMetadata = {
      ...previous,
      tags: ["ai video"],
      category_id: "22",
    };
    expect(reconcileYouTubePublishMetadata(current, previous, next)).toEqual({
      title: "Plan Title",
      description: "Plan description",
      tags: ["seo", "ranking"],
      category_id: "27",
    });
  });

  it("returns the current object when derived metadata did not change", () => {
    const current: YouTubePublishMetadata = { ...previous, title: "My edited title" };
    const next: YouTubePublishMetadata = { ...previous };
    expect(reconcileYouTubePublishMetadata(current, previous, next)).toBe(current);
  });
});

describe("parseYouTubePublishTags", () => {
  it("trims, splits on commas, and de-duplicates", () => {
    expect(parseYouTubePublishTags(" youtube seo , Retention, youtube seo ")).toEqual([
      "youtube seo",
      "Retention",
    ]);
  });

  it("returns [] for blank input", () => {
    expect(parseYouTubePublishTags("")).toEqual([]);
    expect(parseYouTubePublishTags("   ,  ")).toEqual([]);
  });
});

describe("resolveYouTubePublishVideoUrl", () => {
  const clip = (url: string, enabled = true): Scene => ({
    ...scene("Intro"),
    enabled,
    videoUrl: url,
  });

  it("prefers combined, then getVideoUrl, then the first enabled scene clip", () => {
    expect(
      resolveYouTubePublishVideoUrl("/api/youtube/videos/final.mp4", "/api/youtube/videos/fallback.mp4", [
        clip("/api/youtube/videos/scene_1.mp4"),
      ]),
    ).toEqual({ url: "/api/youtube/videos/final.mp4", source: "combined" });
    expect(
      resolveYouTubePublishVideoUrl(null, "/api/youtube/videos/fallback.mp4", [
        clip("/api/youtube/videos/scene_1.mp4"),
      ]),
    ).toEqual({ url: "/api/youtube/videos/fallback.mp4", source: "getVideoUrl" });
    expect(
      resolveYouTubePublishVideoUrl(null, null, [clip("/api/youtube/videos/scene_1.mp4")]),
    ).toEqual({ url: "/api/youtube/videos/scene_1.mp4", source: "scene_clip" });
  });

  it("skips disabled scenes and returns none when no clip exists", () => {
    expect(
      resolveYouTubePublishVideoUrl(null, null, [
        clip("/api/youtube/videos/scene_1.mp4", false),
      ]),
    ).toEqual({ url: null, source: "none" });
    expect(resolveYouTubePublishVideoUrl(null, null, [])).toEqual({ url: null, source: "none" });
  });
});
