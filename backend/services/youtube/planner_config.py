"""YouTube planner video-type and duration configuration."""

from dataclasses import dataclass
from typing import Any, Dict, Optional

from utils.logger_utils import get_service_logger

logger = get_service_logger("youtube.planner_config")


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


SPOKEN_WORDS_PER_MINUTE = 150
DURATION_MAIN_BEAT_COUNT: Dict[str, int] = {
    "shorts": 3,
    "medium": 4,
    "long": 5,
}


def get_main_beat_count(duration_type: str) -> int:
    """Exact main-content beat count so shorts are not expanded from 5 pitch beats."""
    try:
        if duration_type in DURATION_MAIN_BEAT_COUNT:
            return DURATION_MAIN_BEAT_COUNT[duration_type]
        logger.warning(
            "[YouTubePlanner] Unknown duration_type for beat count; using medium duration={}",
            duration_type,
        )
        return DURATION_MAIN_BEAT_COUNT["medium"]
    except Exception:
        logger.exception("[YouTubePlanner] Beat count lookup failed; using medium")
        return DURATION_MAIN_BEAT_COUNT["medium"]


def get_spoken_word_budget(duration_type: str) -> Dict[str, int]:
    """150 WPM spoken budget from duration split. Hook/outro/CTA share the same budget."""
    try:
        ctx = get_duration_context(duration_type)
        target_seconds = int(ctx["target_seconds"])
        beat_count = get_main_beat_count(duration_type)
        wpm = SPOKEN_WORDS_PER_MINUTE
        max_spoken_words = round(target_seconds * wpm / 60)
        hook_words = round(int(ctx["hook_seconds"]) * wpm / 60)
        main_words = round(int(ctx["main_seconds"]) * wpm / 60)
        cta_outro_words = round(int(ctx["cta_seconds"]) * wpm / 60)
        per_beat_words = max(1, round(main_words / beat_count))
        return {
            "max_spoken_words": max_spoken_words,
            "beat_count": beat_count,
            "hook_words": hook_words,
            "main_words": main_words,
            "cta_outro_words": cta_outro_words,
            "per_beat_words": per_beat_words,
            "target_seconds": target_seconds,
        }
    except Exception:
        logger.exception(
            "[YouTubePlanner] Spoken word budget failed duration={}; using medium",
            duration_type,
        )
        ctx = DURATION_CONTEXTS["medium"]
        return {
            "max_spoken_words": round(int(ctx["target_seconds"]) * SPOKEN_WORDS_PER_MINUTE / 60),
            "beat_count": DURATION_MAIN_BEAT_COUNT["medium"],
            "hook_words": round(int(ctx["hook_seconds"]) * SPOKEN_WORDS_PER_MINUTE / 60),
            "main_words": round(int(ctx["main_seconds"]) * SPOKEN_WORDS_PER_MINUTE / 60),
            "cta_outro_words": round(int(ctx["cta_seconds"]) * SPOKEN_WORDS_PER_MINUTE / 60),
            "per_beat_words": round(
                int(ctx["main_seconds"]) * SPOKEN_WORDS_PER_MINUTE / 60
                / DURATION_MAIN_BEAT_COUNT["medium"]
            ),
            "target_seconds": int(ctx["target_seconds"]),
        }


# Matches frontend YOUTUBE_CONTENT_LANGUAGE_OPTIONS labels (code → display name).
CONTENT_LANGUAGE_LABELS: Dict[str, str] = {
    "en": "English",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "pt": "Portuguese",
    "it": "Italian",
    "hi": "Hindi",
    "ar": "Arabic",
    "ru": "Russian",
    "ja": "Japanese",
    "ko": "Korean",
    "zh": "Chinese",
    "vi": "Vietnamese",
    "id": "Indonesian",
    "tr": "Turkish",
    "nl": "Dutch",
    "pl": "Polish",
    "th": "Thai",
}

DEFAULT_CONTENT_LANGUAGE_CODE = "en"
DEFAULT_CONTENT_LANGUAGE_LABEL = "English"


@dataclass(frozen=True)
class ContentLanguageResolution:
    """Normalized pitch/expand content language. Codes are not secrets."""

    code: str
    label: str
    requested: str
    used_fallback: bool


def _normalize_language_token(language_code: Optional[str]) -> str:
    """Strip, lowercase, and take the BCP-47 primary subtag (hi-IN → hi)."""
    raw = (language_code or "").strip().lower()
    if not raw:
        return ""
    primary = raw.replace("_", "-").split("-", 1)[0].strip()
    return primary[:16]


def _english_fallback(requested: str) -> ContentLanguageResolution:
    return ContentLanguageResolution(
        code=DEFAULT_CONTENT_LANGUAGE_CODE,
        label=DEFAULT_CONTENT_LANGUAGE_LABEL,
        requested=requested,
        used_fallback=True,
    )


def resolve_content_language(language_code: Optional[str]) -> ContentLanguageResolution:
    """Resolve Step-1 language to a known code + display label.

    Empty or unknown values fall back to English so the LLM always gets an
    explicit language. Accepts ISO codes (hi), BCP-47 tags (hi-IN), and
    display names (Hindi). Logs codes/labels only — never the video idea.
    """
    requested = _normalize_language_token(language_code)
    if not requested:
        logger.debug("[YouTubePlanner] Content language omitted; using English")
        return _english_fallback("")

    known_label = CONTENT_LANGUAGE_LABELS.get(requested)
    if known_label:
        return ContentLanguageResolution(
            code=requested,
            label=known_label,
            requested=requested,
            used_fallback=False,
        )

    labels_to_codes = {
        label.lower(): code for code, label in CONTENT_LANGUAGE_LABELS.items()
    }
    mapped_code = labels_to_codes.get(requested)
    if mapped_code:
        mapped_label = CONTENT_LANGUAGE_LABELS[mapped_code]
        logger.info(
            "[YouTubePlanner] Content language display name mapped to code={} label={}",
            mapped_code,
            mapped_label,
        )
        return ContentLanguageResolution(
            code=mapped_code,
            label=mapped_label,
            requested=requested,
            used_fallback=False,
        )

    logger.warning(
        "[YouTubePlanner] Unknown content language; using English. requested={}",
        requested,
    )
    return _english_fallback(requested)


def resolve_content_language_label(language_code: Optional[str]) -> str:
    """Map a Step-1 language value to a prompt label (e.g. hi → Hindi)."""
    return resolve_content_language(language_code).label
