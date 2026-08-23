import { mapPitchToVideoPlan, toYouTubeVideoPitch } from "./mapPitchToVideoPlan";
import type { YouTubeExpansionPayload, YouTubePitchPayload } from "../../../services/youtubePitchApi";

const pitch: YouTubePitchPayload = {
  selected_title: "Stop Overpacking for Weekend Trips",
  video_summary: "A three-item packing rule that beats the stuffed suitcase.",
  hook_concept: "You do not need a big bag.",
  main_content_beats: ["Pick three items", "Wear the bulky one", "Leave the just-in-case pile"],
  angle_used: "Contrarian",
  generation: {
    text_gateway: "llm_text_gen",
    system_prompt: "You are ALwrity Pitch.",
    user_prompt: "Generate a pitch.",
    json_schema_applied: true,
  },
  research_enabled: true,
};

const expansion: YouTubeExpansionPayload = {
  hook: {
    context: "Weekend trip packing",
    common_belief: "You need a suitcase",
    contrarian_turn: "Three items are enough",
    proof: "Twelve trips, no extra bag",
    plan_statement: "Here is the rule",
    spoken_script: "Stop stuffing a suitcase for a two-day trip.",
  },
  main_content_outline: [
    {
      scene_number: 1,
      section_title: "The three-item rule",
      spoken_script: "Choose one outfit, one layer, one tool.",
      visual: "Lay clothes on a bed",
      estimated_duration_seconds: 40,
    },
    {
      scene_number: 2,
      section_title: "Wear the bulky piece",
      spoken_script: "Put the jacket on, not in the bag.",
      visual: "Put on a jacket",
      estimated_duration_seconds: 50,
    },
  ],
  outro: "You packed less and still had everything.",
  call_to_action: "Try it on your next weekend trip.",
  key_message: "Pack less, enjoy more.",
  seo_keywords: ["packing", "travel"],
  full_script: "Stop stuffing a suitcase for a two-day trip.\n\nChoose one outfit, one layer, one tool.",
  approved_title: "Stop Overpacking for Weekend Trips",
  duration_type: "medium",
  duration_metadata: { target_seconds: 150, hook_seconds: 10 },
  generation: { text_gateway: "llm_text_gen", json_schema_applied: true },
  research_enabled: true,
  research_sources_count: 2,
};

describe("toYouTubeVideoPitch", () => {
  it("maps API pitch fields and uses angle_used", () => {
    const mapped = toYouTubeVideoPitch(pitch, "Storytelling");
    expect(mapped.selected_title).toBe(pitch.selected_title);
    expect(mapped.creative_angle).toBe("Contrarian");
    expect(mapped.main_content_beats).toHaveLength(3);
    expect(mapped.id).toBeTruthy();
    expect(mapped.generation?.system_prompt).toBe("You are ALwrity Pitch.");
    expect(mapped.generation?.user_prompt).toBe("Generate a pitch.");
    expect(mapped.research_enabled).toBe(true);
  });
});

describe("mapPitchToVideoPlan", () => {
  it("maps expansion onto VideoPlan fields used by Build Scenes", () => {
    const plan = mapPitchToVideoPlan({
      pitch,
      expansion,
      form: {
        duration_type: "medium",
        target_audience: "Weekend travelers",
        video_goal: "Educate",
        brand_style: "Clean and practical",
      },
    });

    expect(plan.selected_title).toBe("Stop Overpacking for Weekend Trips");
    expect(plan.video_summary).toBe(pitch.video_summary);
    expect(plan.hook_strategy).toBe("Stop stuffing a suitcase for a two-day trip.");
    expect(plan.content_outline).toEqual([
      {
        section: "The three-item rule",
        description: "Choose one outfit, one layer, one tool.",
        duration_estimate: 40,
      },
      {
        section: "Wear the bulky piece",
        description: "Put the jacket on, not in the bag.",
        duration_estimate: 50,
      },
    ]);
    expect(plan.call_to_action).toBe("Try it on your next weekend trip.");
    expect(plan.key_message).toBe("Pack less, enjoy more.");
    expect(plan.seo_keywords).toEqual(["packing", "travel"]);
    expect(plan.duration_type).toBe("medium");
    expect(plan.generation?.json_schema_applied).toBe(true);
  });

  it("uses form fields for echoed Step-1 metadata instead of inventing them", () => {
    const plan = mapPitchToVideoPlan({
      pitch,
      expansion,
      form: {
        duration_type: "shorts",
        target_audience: "Travelers",
        video_goal: "Entertain",
        brand_style: "Warm vlog",
      },
    });

    expect(plan.target_audience).toBe("Travelers");
    expect(plan.video_goal).toBe("Entertain");
    expect(plan.visual_style).toBe("Warm vlog");
    expect(plan.tone).toBe("Warm vlog");
  });
});
