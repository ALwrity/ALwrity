"""Curated persona context for content generation.

Extracts the persona slices a content-generation prompt needs — brand voice,
tone, language, style, per-platform guidance, and audience — and omits the
meta fields (evidence, what_was_missing, confidence, quality metrics) that
content generation does not use.

Pure — no I/O. Input is a ``PersonaData.to_dict()`` payload (or the
``step4_persona_data.json`` flat-context equivalent).

DESIGN (style vs topic): this is the STYLE layer — it tells the model HOW the
brand writes (tone, phrases, sentence style), never WHAT to write. It is
injected as a small system/voice section, not the whole persona blob (the LLM
doesn't need evidence citations or quality scores). See
``persona_resolver.py`` for the full design intent + phase map.
"""

from typing import Any, Dict, Optional


_PLATFORM_DISPLAY_NAMES = {
    "linkedin": "LinkedIn",
    "youtube": "YouTube",
}


def _safe_str(value: Any, fallback: str = "") -> str:
    """Coerce a persona field to a compact string (None -> '', lists joined)."""
    if value is None:
        return fallback
    if isinstance(value, str):
        return value
    if isinstance(value, (list, tuple)):
        return ", ".join(str(v) for v in value)
    return str(value)


def _identity_text(identity: Dict[str, Any]) -> str:
    name = _safe_str(identity.get("persona_name"))
    archetype = _safe_str(identity.get("archetype"))
    belief = _safe_str(identity.get("core_belief"))
    voice = _safe_str(identity.get("brand_voice_description"))

    parts = []
    if name and archetype:
        parts.append(f"You are writing as {name} ({archetype})")
    elif name:
        parts.append(f"You are writing as {name}")
    if belief:
        parts.append(f"Core belief: {belief}")
    if voice:
        parts.append(f"Voice: {voice}")
    if not parts:
        return ""
    return " ".join(parts) + "."


def _tone_text(tonal: Dict[str, Any]) -> str:
    default = _safe_str(tonal.get("default_tone"))
    permissible = _safe_str(tonal.get("permissible_tones"))
    forbidden = _safe_str(tonal.get("forbidden_tones"))

    parts = []
    if default:
        parts.append(f"Default tone: {default}")
    if permissible:
        parts.append(f"Also acceptable: {permissible}")
    if forbidden:
        parts.append(f"Never use: {forbidden}")
    if not parts:
        return ""
    return " ".join(parts) + "."


def _language_text(lexical: Dict[str, Any]) -> str:
    phrases = _safe_str(lexical.get("go_to_phrases"))
    words = _safe_str(lexical.get("go_to_words"))
    avoid = _safe_str(lexical.get("avoid_words"))
    vocabulary = _safe_str(lexical.get("vocabulary_level"))

    parts = []
    if phrases:
        parts.append(f"Use phrases like: {phrases}")
    if words:
        parts.append(f"Use words like: {words}")
    if avoid:
        parts.append(f"Avoid words: {avoid}")
    if vocabulary:
        parts.append(f"Vocabulary level: {vocabulary}")
    if not parts:
        return ""
    return " ".join(parts) + "."


def _style_text(linguistic: Dict[str, Any], stylistic: Dict[str, Any]) -> str:
    sentence = linguistic.get("sentence_metrics") or {}
    rhetorical = linguistic.get("rhetorical_devices") or {}
    punctuation = stylistic.get("punctuation") or {}
    formatting = stylistic.get("formatting") or {}

    avg_len = _safe_str(sentence.get("average_sentence_length_words"))
    preferred = _safe_str(sentence.get("preferred_sentence_type"))
    voice = _safe_str(sentence.get("active_to_passive_ratio"))
    complexity = _safe_str(sentence.get("complexity_level"))
    storytelling = _safe_str(rhetorical.get("storytelling_style"))

    parts = []
    style_bits = [b for b in (avg_len, preferred, voice, complexity) if b]
    if style_bits:
        parts.append("Sentence style: " + ", ".join(style_bits))
    if storytelling:
        parts.append(f"Storytelling: {storytelling}")

    # Punctuation / formatting: surface the value (e.g. "em_dash=frequent"),
    # not just the key.
    punct_pairs = [f"{k}={_safe_str(v)}" for k, v in punctuation.items() if v]
    if punct_pairs:
        parts.append("Punctuation: " + ", ".join(punct_pairs))
    fmt_pairs = [f"{k}={_safe_str(v)}" for k, v in formatting.items() if v]
    if fmt_pairs:
        parts.append("Formatting: " + ", ".join(fmt_pairs))

    if not parts:
        return ""
    return " ".join(parts) + "."


def _platform_text(platform: str, p: Dict[str, Any]) -> str:
    name = _safe_str(p.get("persona_name") or p.get("name") or p.get("platform_type"))
    archetype = _safe_str(p.get("archetype"))
    belief = _safe_str(p.get("core_belief"))
    tone = _safe_str(p.get("default_tone") or p.get("tone"))

    parts = []
    if name:
        parts.append(f"On {platform}, write as {name}")
    if archetype:
        parts.append(f"positioning: {archetype}")
    if belief:
        parts.append(f"core belief: {belief}")
    if tone:
        parts.append(f"tone: {tone}")
    if not parts:
        return ""
    return " ".join(parts) + "."


def _audience_text(core: Dict[str, Any], platform_persona: Dict[str, Any], audience: Optional[str]) -> str:
    parts = []
    if audience:
        parts.append(_safe_str(audience))
    # Facebook personas carry explicit audience targeting.
    if isinstance(platform_persona, dict):
        fb = platform_persona.get("facebook_audience_targeting")
        if isinstance(fb, dict) and fb:
            bits = []
            for key in ("demographic_targeting", "interest_targeting", "behavioral_targeting"):
                v = _safe_str(fb.get(key))
                if v:
                    bits.append(v)
            if bits:
                parts.append("Facebook audience: " + "; ".join(bits))
    if not parts:
        return ""
    return "Audience: " + ". ".join(parts) + "."


def get_persona_context_for_generation(
    persona: Dict[str, Any],
    platform: Optional[str] = None,
    audience: Optional[str] = None,
) -> str:
    """Build a compact, platform-scoped brand-voice block for a generation prompt.

    Returns an empty string when there is no usable persona data. Omits meta
    fields (evidence, what_was_missing, confidence, quality_metrics).
    """
    if not isinstance(persona, dict):
        return ""

    core = persona.get("core_persona")
    if not isinstance(core, dict):
        return ""

    identity = core.get("identity") or {}
    tonal = core.get("tonal_range") or {}
    linguistic = core.get("linguistic_fingerprint") or {}
    lexical = linguistic.get("lexical_features") or {}
    stylistic = core.get("stylistic_constraints") or {}

    platforms = persona.get("platform_personas") or {}
    platform_persona = platforms.get(platform) if isinstance(platforms, dict) else None
    if not isinstance(platform_persona, dict):
        platform_persona = {}

    sections = [
        ("Brand Voice", _identity_text(identity)),
        ("Tone", _tone_text(tonal)),
        ("Language", _language_text(lexical)),
        ("Style", _style_text(linguistic, stylistic)),
    ]
    if platform:
        pt = _platform_text(platform, platform_persona)
        if pt:
            display = _PLATFORM_DISPLAY_NAMES.get(platform, platform.capitalize())
            sections.append((f"{display} Guidance", pt))
    aud = _audience_text(core, platform_persona, audience)
    if aud:
        sections.append(("Audience", aud))

    blocks = [f"# {title}\n{body}" for title, body in sections if body]
    return "\n\n".join(blocks)
