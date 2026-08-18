import type { Scene } from "../../../services/youtubeApi";

/** Build WaveSpeed narration with delivery hints. Extracted from the Video Creator panel. */
export function buildEnrichedSceneText(scene: Scene): string {
  let enrichedText = scene.narration;

  if (scene.title && scene.title !== scene.narration.substring(0, scene.title.length)) {
    enrichedText = `${scene.title}. ${enrichedText}`;
  }

  if (scene.emphasis_tags && scene.emphasis_tags.length > 0) {
    const deliveryHints = scene.emphasis_tags.map((tag) => {
      switch (tag) {
        case "hook":
          return "speak with energy and excitement";
        case "cta":
          return "speak persuasively and confidently";
        case "transition":
          return "speak smoothly and clearly";
        default:
          return "speak professionally and clearly";
      }
    });
    enrichedText += ` [${deliveryHints[0]}]`;
  }

  if (scene.visual_cues && scene.visual_cues.length > 0) {
    const audioRelevantCues = scene.visual_cues.filter(
      (cue) =>
        cue.toLowerCase().includes("slow") ||
        cue.toLowerCase().includes("fast") ||
        cue.toLowerCase().includes("energetic") ||
        cue.toLowerCase().includes("calm") ||
        cue.toLowerCase().includes("dramatic") ||
        cue.toLowerCase().includes("intense"),
    );
    if (audioRelevantCues.length > 0) {
      enrichedText += ` [Pacing: ${audioRelevantCues.join(", ")}]`;
    }
  }

  if (scene.duration_estimate && scene.duration_estimate > 0) {
    const wordsPerMinute = enrichedText.split(" ").length / (scene.duration_estimate / 60);
    if (wordsPerMinute > 200) {
      enrichedText += ` [Speak at a natural, conversational pace]`;
    } else if (wordsPerMinute < 120) {
      enrichedText += ` [Take time to articulate clearly]`;
    }
  }

  if (enrichedText.length > 9500) {
    enrichedText = `${enrichedText.substring(0, 9500)}...`;
  }

  return enrichedText;
}
