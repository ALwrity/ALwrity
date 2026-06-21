"""
Parse raw LLM text into structured LinkedIn content shapes.
"""

import re
from typing import Any, Dict, List, Optional


_SECTION_ALIASES = {
    "hook": ("hook", "opening", "intro", "introduction", "attention grabber"),
    "main_content": (
        "main content",
        "main",
        "body",
        "scenes",
        "script",
        "key insights",
        "content",
    ),
    "conclusion": ("conclusion", "closing", "cta", "call to action", "outro", "wrap up"),
    "captions": ("captions", "caption", "subtitles"),
    "thumbnail_suggestions": (
        "thumbnail",
        "thumbnails",
        "thumbnail suggestions",
        "thumbnail design",
    ),
    "video_description": ("video description", "description", "summary"),
}


def _normalize_heading(line: str) -> str:
    text = line.strip()
    text = re.sub(r"^#+\s*", "", text)
    text = re.sub(r"^\*+\s*", "", text)
    text = re.sub(r"^[-–—]+\s*", "", text)
    text = re.sub(r":\s*$", "", text)
    return text.strip().lower()


def _match_section(heading: str) -> Optional[str]:
    normalized = _normalize_heading(heading)
    for section_key, aliases in _SECTION_ALIASES.items():
        if normalized in aliases or any(normalized.startswith(alias) for alias in aliases):
            return section_key
    return None


def _split_into_sections(content: str) -> Dict[str, str]:
    sections: Dict[str, str] = {}
    current_key: Optional[str] = None
    current_lines: List[str] = []

    for line in content.splitlines():
        stripped = line.strip()
        is_heading = stripped.startswith("#") or (
            stripped.endswith(":") and len(stripped) < 80 and _match_section(stripped)
        )

        if is_heading:
            if current_key and current_lines:
                sections[current_key] = "\n".join(current_lines).strip()
            current_key = _match_section(stripped)
            current_lines = []
            continue

        if current_key:
            current_lines.append(line)

    if current_key and current_lines:
        sections[current_key] = "\n".join(current_lines).strip()

    return sections


def normalize_scene(scene: Dict[str, Any]) -> Dict[str, str]:
    """Ensure scene fields match VideoScript.main_content Dict[str, str] contract."""
    duration = scene.get("duration", 30)
    duration_str = str(duration)
    if duration_str.isdigit():
        duration_str = f"{duration_str}s"
    return {
        "scene_number": str(scene.get("scene_number", "")),
        "content": str(scene.get("content", "")),
        "duration": duration_str,
        "visual_notes": str(scene.get("visual_notes", "")),
    }


def normalize_main_content(scenes: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    return [normalize_scene(scene) for scene in scenes]


def _split_main_content(text: str) -> List[Dict[str, str]]:
    if not text.strip():
        return []

    scene_pattern = re.compile(
        r"^(?:###?\s*)?(?:scene|segment|part)\s*(\d+)[:\s-]*(.*)$",
        re.IGNORECASE,
    )
    scenes: List[Dict[str, Any]] = []
    current_scene: Optional[Dict[str, Any]] = None
    current_lines: List[str] = []

    for line in text.splitlines():
        match = scene_pattern.match(line.strip())
        if match:
            if current_scene is not None:
                current_scene["content"] = "\n".join(current_lines).strip()
                scenes.append(current_scene)
            scene_num = int(match.group(1))
            title = match.group(2).strip()
            current_scene = {
                "scene_number": scene_num,
                "content": title,
                "duration": 30,
                "visual_notes": "",
            }
            current_lines = [] if title else []
            continue

        if current_scene is not None:
            current_lines.append(line)

    if current_scene is not None:
        current_scene["content"] = "\n".join(current_lines).strip()
        scenes.append(current_scene)

    if scenes:
        return normalize_main_content(scenes)

    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    if not paragraphs:
        paragraphs = [text.strip()] if text.strip() else []

    return normalize_main_content([
        {
            "scene_number": i + 1,
            "content": paragraph,
            "duration": 30,
            "visual_notes": "Professional presentation style",
        }
        for i, paragraph in enumerate(paragraphs)
    ])


def _extract_hook_fallback(lines: List[str]) -> str:
    hook_lines: List[str] = []
    for line in lines[:5]:
        stripped = line.strip()
        if stripped and not stripped.startswith("#"):
            hook_lines.append(stripped)
            if len(" ".join(hook_lines)) > 100:
                break
    return " ".join(hook_lines)


def _extract_conclusion_fallback(lines: List[str]) -> str:
    conclusion_lines: List[str] = []
    for line in lines[-5:]:
        stripped = line.strip()
        if stripped and not stripped.startswith("#"):
            conclusion_lines.insert(0, stripped)
            if len(" ".join(conclusion_lines)) > 100:
                break
    return " ".join(conclusion_lines)


def _parse_list_items(text: str) -> List[str]:
    items: List[str] = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        stripped = re.sub(r"^[-*•]\s+", "", stripped)
        stripped = re.sub(r"^\d+\.\s+", "", stripped)
        if stripped:
            items.append(stripped)
    return items


def parse_video_script_text(content: str) -> Dict[str, Any]:
    """
    Parse raw LLM video script text into structured fields for VideoScriptGenerator.
    """
    content = (content or "").strip()
    if not content:
        return {
            "hook": "",
            "main_content": [],
            "conclusion": "",
            "captions": None,
            "thumbnail_suggestions": [],
            "video_description": "",
        }

    sections = _split_into_sections(content)
    lines = content.splitlines()

    hook = sections.get("hook", "")
    conclusion = sections.get("conclusion", "")
    main_text = sections.get("main_content", "")

    if not hook:
        hook = _extract_hook_fallback(lines)
    if not conclusion:
        conclusion = _extract_conclusion_fallback(lines)
    if not main_text:
        start = len(hook)
        end = len(content) - len(conclusion) if conclusion else len(content)
        main_text = content[start:end].strip()

    main_content = _split_main_content(main_text)
    if not main_content and main_text:
        main_content = normalize_main_content([
            {
                "scene_number": 1,
                "content": main_text,
                "duration": 60,
                "visual_notes": "Professional presentation style",
            }
        ])

    captions_text = sections.get("captions", "")
    captions = _parse_list_items(captions_text) if captions_text else None

    thumbnail_text = sections.get("thumbnail_suggestions", "")
    thumbnail_suggestions = _parse_list_items(thumbnail_text) if thumbnail_text else [
        "Professional thumbnail",
        "Industry-focused image",
    ]

    video_description = sections.get("video_description", "")
    if not video_description:
        preview = hook or (main_content[0]["content"] if main_content else content[:100])
        video_description = f"Professional insights on {preview[:100]}..."

    return {
        "hook": hook,
        "main_content": main_content,
        "conclusion": conclusion,
        "captions": captions,
        "thumbnail_suggestions": thumbnail_suggestions,
        "video_description": video_description,
    }
