import { buildScenePromptPreview } from "./buildScenePromptPreview";
import type { VideoPlan } from "../../../services/youtubeApi";

const plan: VideoPlan = {
  video_summary: "Budget travel tips",
  target_audience: "Travelers",
  video_goal: "Educate",
  key_message: "Save money",
  content_outline: [
    { section: "Hook", description: "Open strong", duration_estimate: 10 },
  ],
  hook_strategy: "Ask a question",
  call_to_action: "Subscribe",
  visual_style: "cinematic",
  tone: "friendly",
  seo_keywords: [],
  duration_type: "medium",
  duration_metadata: {
    scene_duration_range: [5, 15],
    target_seconds: 90,
    hook_seconds: 8,
  },
};

describe("buildScenePromptPreview", () => {
  it("includes plan fields in the user prompt template", () => {
    const preview = buildScenePromptPreview(plan);

    expect(preview.systemPrompt).toContain("master YouTube scriptwriter");
    expect(preview.userPromptTemplate).toContain("Budget travel tips");
    expect(preview.userPromptTemplate).toContain("Open strong");
    expect(preview.userPromptTemplate).toContain("5-15 seconds");
  });
});
