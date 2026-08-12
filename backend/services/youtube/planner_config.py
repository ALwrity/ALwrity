"""YouTube planner video-type and duration configuration."""

from typing import Any, Dict


VIDEO_TYPE_CONFIGS = {
    "tutorial": {
        "hook_strategy": "Problem statement or quick preview of solution",
        "structure": "Problem → Steps → Result → Key Takeaways",
        "visual_style": "Clean, instructional, screen-recordings or clear demonstrations",
        "tone": "Clear, patient, instructional",
        "optimal_scenes": "2-6 scenes showing sequential steps",
        "avatar_style": "Approachable instructor, professional yet friendly",
        "cta_focus": "Subscribe for more tutorials, try it yourself"
    },
    "review": {
        "hook_strategy": "Product reveal or strong opinion statement",
        "structure": "Hook → Overview → Pros/Cons → Verdict → CTA",
        "visual_style": "Product-focused, close-ups, comparison shots",
        "tone": "Honest, engaging, opinionated but fair",
        "optimal_scenes": "4-8 scenes covering different aspects",
        "avatar_style": "Trustworthy reviewer, confident, credible",
        "cta_focus": "Check links in description, subscribe for reviews"
    },
    "educational": {
        "hook_strategy": "Intriguing question or surprising fact",
        "structure": "Question → Explanation → Examples → Conclusion",
        "visual_style": "Illustrative, concept visualization, animations",
        "tone": "Authoritative yet accessible, engaging",
        "optimal_scenes": "3-10 scenes breaking down concepts",
        "avatar_style": "Knowledgeable educator, professional, warm",
        "cta_focus": "Learn more, subscribe for educational content"
    },
    "entertainment": {
        "hook_strategy": "Grab attention immediately with energy/humor",
        "structure": "Hook → Setup → Payoff → Share/Subscribe",
        "visual_style": "Dynamic, energetic, varied angles, transitions",
        "tone": "High energy, funny, engaging, personality-driven",
        "optimal_scenes": "3-8 scenes with varied pacing",
        "avatar_style": "Energetic creator, expressive, relatable",
        "cta_focus": "Like, share, subscribe for more fun content"
    },
    "vlog": {
        "hook_strategy": "Preview of day/event or personal moment",
        "structure": "Introduction → Journey/Experience → Reflection → CTA",
        "visual_style": "Natural, personal, authentic moments",
        "tone": "Conversational, authentic, relatable",
        "optimal_scenes": "5-15 scenes following narrative",
        "avatar_style": "Authentic person, approachable, real",
        "cta_focus": "Follow my journey, subscribe for daily updates"
    },
    "product_demo": {
        "hook_strategy": "Product benefit or transformation",
        "structure": "Benefit → Features → Use Cases → CTA",
        "visual_style": "Product-focused, polished, commercial quality",
        "tone": "Enthusiastic, persuasive, benefit-focused",
        "optimal_scenes": "3-7 scenes highlighting features",
        "avatar_style": "Professional presenter, polished, confident",
        "cta_focus": "Get it now, learn more, special offer"
    },
    "reaction": {
        "hook_strategy": "Preview of reaction or content being reacted to",
        "structure": "Setup → Reaction → Commentary → CTA",
        "visual_style": "Split-screen or picture-in-picture, expressive",
        "tone": "Authentic reactions, engaging commentary",
        "optimal_scenes": "4-10 scenes with reactions",
        "avatar_style": "Expressive creator, authentic reactions",
        "cta_focus": "Watch full video, subscribe for reactions"
    },
    "storytelling": {
        "hook_strategy": "Intriguing opening or compelling question",
        "structure": "Hook → Setup → Conflict → Resolution → CTA",
        "visual_style": "Cinematic, narrative-driven, emotional",
        "tone": "Engaging, immersive, story-focused",
        "optimal_scenes": "6-15 scenes following narrative arc",
        "avatar_style": "Storyteller, warm, engaging narrator",
        "cta_focus": "Subscribe for more stories, share your thoughts"
    }
}


DURATION_CONTEXTS: Dict[str, Dict[str, Any]] = {
    "shorts": {
        "description": "YouTube Shorts (15-60 seconds)",
        "target_seconds": 30,
        "hook_seconds": 3,
        "main_seconds": 24,
        "cta_seconds": 3,
        # Keep scenes tight for shorts to control cost and pacing
        "max_scenes": 4,
        "scene_duration_range": (2, 8)
    },
    "medium": {
        "description": "Medium-length video (1-4 minutes)",
        "target_seconds": 150,  # 2.5 minutes
        "hook_seconds": 10,
        "main_seconds": 130,
        "cta_seconds": 10,
        "max_scenes": 12,
        "scene_duration_range": (5, 15)
    },
    "long": {
        "description": "Long-form video (4-10 minutes)",
        "target_seconds": 420,  # 7 minutes
        "hook_seconds": 15,
        "main_seconds": 380,
        "cta_seconds": 25,
        "max_scenes": 20,
        "scene_duration_range": (10, 30)
    }
}


def get_duration_context(duration_type: str) -> Dict[str, Any]:
    """Get duration-specific context and constraints."""
    return DURATION_CONTEXTS.get(duration_type, DURATION_CONTEXTS["medium"])
