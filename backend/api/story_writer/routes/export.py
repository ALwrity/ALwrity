"""
Story export routes (ZIP package and PDF).

Provides authenticated endpoints for exporting a completed story and its
associated generated media (scene images, audio narration, video) as a
downloadable archive or PDF.
"""

from __future__ import annotations

import io
import json
import re
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from loguru import logger
from pydantic import BaseModel, Field
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Image,
    PageBreak,
    KeepTogether,
)

from middleware.auth_middleware import get_current_user

from ..utils.auth import require_authenticated_user
from ..utils.media_utils import (
    load_story_image_bytes,
    load_story_audio_bytes,
    resolve_story_media_path,
)


router = APIRouter()

# --------------------------------------------------------------------------- #
# Request schemas
# --------------------------------------------------------------------------- #


class SceneMediaMap(BaseModel):
    """Mapping of scene number to media URL."""

    scene_images: Dict[str, str] = Field(default_factory=dict)
    scene_audio: Dict[str, str] = Field(default_factory=dict)


class StoryExportRequest(BaseModel):
    """Payload required to export a story."""

    story_title: str = Field(default="My Story")
    story_setup: Optional[Dict[str, Any]] = None
    outline: Any = None
    story_content: str = Field(..., min_length=1)
    scene_media: SceneMediaMap = Field(default_factory=SceneMediaMap)
    story_video: Optional[str] = None


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #


def _safe_filename(name: str) -> str:
    """Convert an arbitrary string into a filesystem-safe base name."""
    safe = re.sub(r"[^\w\- .]", "_", name).strip()
    safe = re.sub(r"\s+", "_", safe)
    return safe or "story"


def _extract_video_filename(video_url: Optional[str]) -> Optional[str]:
    if not video_url:
        return None
    parsed = urlparse(video_url)
    path = parsed.path if parsed.scheme else video_url
    prefix = "/api/story/videos/"
    if prefix not in path:
        return Path(path).name or None
    return path.split(prefix, 1)[1].split("?", 1)[0].strip() or None


def _load_video_bytes(video_url: str, user_id: str) -> Optional[bytes]:
    filename = _extract_video_filename(video_url)
    if not filename:
        return None
    try:
        file_path = resolve_story_media_path(filename, "video", user_id)
        return file_path.read_bytes()
    except HTTPException:
        logger.warning(f"[StoryExport] Referenced story video not found: {filename}")
        return None
    except Exception as exc:
        logger.error(f"[StoryExport] Failed to load video bytes: {exc}")
        return None


def _format_outline_text(outline: Any) -> str:
    """Render outline data as human-readable text."""
    if outline is None:
        return ""
    if isinstance(outline, list):
        lines = []
        for idx, scene in enumerate(outline, start=1):
            if isinstance(scene, dict):
                number = scene.get("scene_number", idx)
                title = scene.get("title", "Untitled")
                desc = scene.get("description", "")
                lines.append(f"Scene {number}: {title}\n{desc}")
            else:
                lines.append(str(scene))
        return "\n\n".join(lines)
    return str(outline)


# --------------------------------------------------------------------------- #
# ZIP package export
# --------------------------------------------------------------------------- #


@router.post("/export-package")
async def export_story_package(
    request: StoryExportRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> StreamingResponse:
    """Export the story and its generated media as a ZIP archive."""
    user_id = require_authenticated_user(current_user)
    base_name = _safe_filename(request.story_title)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    zip_name = f"{base_name}_{timestamp}.zip"

    try:
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            # Story text
            zf.writestr(
                f"{base_name}/story.txt",
                request.story_content.encode("utf-8"),
            )

            # Story setup metadata
            if request.story_setup:
                zf.writestr(
                    f"{base_name}/story_setup.json",
                    json.dumps(request.story_setup, indent=2, default=str).encode("utf-8"),
                )

            # Outline
            outline_text = _format_outline_text(request.outline)
            if outline_text:
                zf.writestr(
                    f"{base_name}/outline.txt",
                    outline_text.encode("utf-8"),
                )

            # Scene images
            for scene_number, image_url in request.scene_media.scene_images.items():
                image_bytes = load_story_image_bytes(image_url, user_id)
                if image_bytes:
                    ext = Path(urlparse(image_url).path).suffix or ".png"
                    zf.writestr(
                        f"{base_name}/images/scene_{scene_number}{ext}",
                        image_bytes,
                    )

            # Scene audio
            for scene_number, audio_url in request.scene_media.scene_audio.items():
                audio_bytes = load_story_audio_bytes(audio_url, user_id)
                if audio_bytes:
                    ext = Path(urlparse(audio_url).path).suffix or ".mp3"
                    zf.writestr(
                        f"{base_name}/audio/scene_{scene_number}{ext}",
                        audio_bytes,
                    )

            # Story video
            if request.story_video:
                video_bytes = _load_video_bytes(request.story_video, user_id)
                if video_bytes:
                    video_filename = _extract_video_filename(request.story_video) or "story_video.mp4"
                    zf.writestr(
                        f"{base_name}/video/{video_filename}",
                        video_bytes,
                    )

        buffer.seek(0)
        return StreamingResponse(
            buffer,
            media_type="application/zip",
            headers={"Content-Disposition": f'attachment; filename="{zip_name}"'},
        )

    except Exception as exc:
        logger.error(f"[StoryExport] Package export failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export story package: {exc}",
        )


# --------------------------------------------------------------------------- #
# PDF export
# --------------------------------------------------------------------------- #


def _build_pdf(request: StoryExportRequest, user_id: str) -> bytes:
    """Build a PDF containing story metadata, content, and scene images."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=0.75 * inch,
        leftMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "StoryTitle",
        parent=styles["Heading1"],
        fontSize=22,
        spaceAfter=18,
        alignment=1,  # center
    )
    heading_style = ParagraphStyle(
        "StoryHeading",
        parent=styles["Heading2"],
        fontSize=14,
        spaceAfter=10,
        spaceBefore=16,
    )
    body_style = ParagraphStyle(
        "StoryBody",
        parent=styles["BodyText"],
        fontSize=11,
        leading=15,
        spaceAfter=10,
    )
    caption_style = ParagraphStyle(
        "ImageCaption",
        parent=styles["Italic"],
        fontSize=10,
        alignment=1,
        spaceAfter=14,
    )

    story_elements: List[Any] = []

    # Title
    story_elements.append(Paragraph(request.story_title, title_style))
    story_elements.append(
        Paragraph(f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}", styles["Normal"])
    )
    story_elements.append(Spacer(1, 0.25 * inch))

    # Story setup summary
    if request.story_setup:
        setup_fields = [
            ("Genre", request.story_setup.get("genre")),
            ("Writing Style", request.story_setup.get("writing_style")),
            ("Tone", request.story_setup.get("story_tone")),
            ("POV", request.story_setup.get("narrative_pov")),
            ("Audience", request.story_setup.get("audience_age_group")),
            ("Length", request.story_setup.get("story_length")),
        ]
        setup_lines = [f"<b>{label}:</b> {value}" for label, value in setup_fields if value]
        if setup_lines:
            story_elements.append(Paragraph("Story Setup", heading_style))
            for line in setup_lines:
                story_elements.append(Paragraph(line, body_style))
            story_elements.append(Spacer(1, 0.15 * inch))

    # Outline
    outline_text = _format_outline_text(request.outline)
    if outline_text:
        story_elements.append(Paragraph("Outline", heading_style))
        for line in outline_text.splitlines():
            if line.strip():
                story_elements.append(Paragraph(line, body_style))
        story_elements.append(Spacer(1, 0.15 * inch))

    # Determine scene count from outline for content splitting
    outline_scenes: List[Dict[str, Any]] = []
    if isinstance(request.outline, list):
        outline_scenes = [s for s in request.outline if isinstance(s, dict)]
    num_scenes = len(outline_scenes) if outline_scenes else 0

    # Helper to split content into roughly equal sections per scene
    def _split_content(content: str, sections: int) -> List[str]:
        if not content or sections <= 1:
            return [content or ""]
        paragraphs = [p for p in re.split(r"\n\s*\n", content) if p.strip()]
        if not paragraphs:
            return [content]
        if len(paragraphs) <= sections:
            result = list(paragraphs)
            while len(result) < sections:
                result.append("")
            return result
        base = len(paragraphs) // sections
        remainder = len(paragraphs) % sections
        result = []
        pos = 0
        for i in range(sections):
            take = base + (1 if i < remainder else 0)
            result.append("\n\n".join(paragraphs[pos:pos + take]))
            pos += take
        return result

    # Story content with inline scene images
    story_elements.append(PageBreak())
    story_elements.append(Paragraph("Story", heading_style))

    image_map = dict(sorted(request.scene_media.scene_images.items(), key=lambda item: int(item[0])))

    if num_scenes > 0 and image_map:
        sections = _split_content(request.story_content, num_scenes)
        for idx, scene in enumerate(outline_scenes):
            scene_key = str(scene.get("scene_number", idx + 1))
            scene_title = scene.get("title", f"Scene {scene_key}")

            # Scene heading
            story_elements.append(Paragraph(f"<b>{scene_title}</b>", body_style))

            # Scene text
            section_text = sections[idx] if idx < len(sections) else ""
            if section_text:
                for paragraph in section_text.split("\n\n"):
                    if paragraph.strip():
                        story_elements.append(Paragraph(paragraph.replace("\n", "<br/>"), body_style))

            # Scene image
            image_url = image_map.get(scene_key)
            if image_url:
                image_bytes = load_story_image_bytes(image_url, user_id)
                if image_bytes:
                    image_buffer = io.BytesIO(image_bytes)
                    try:
                        img = Image(image_buffer, width=5 * inch, height=3.125 * inch)
                        img.hAlign = "CENTER"
                        story_elements.append(KeepTogether([
                            img,
                            Paragraph(scene_title, caption_style),
                        ]))
                    except Exception as exc:
                        logger.warning(f"[StoryExport] Could not embed scene {scene_key} image in PDF: {exc}")

            story_elements.append(Spacer(1, 0.15 * inch))
    else:
        # No scene data — render as plain text
        for paragraph in request.story_content.split("\n\n"):
            if paragraph.strip():
                story_elements.append(Paragraph(paragraph.replace("\n", "<br/>"), body_style))

        # Append any images at the end
        image_entries = sorted(request.scene_media.scene_images.items(), key=lambda item: int(item[0]))
        if image_entries:
            story_elements.append(PageBreak())
            story_elements.append(Paragraph("Scene Images", heading_style))
            for scene_number, image_url in image_entries:
                image_bytes = load_story_image_bytes(image_url, user_id)
                if not image_bytes:
                    continue
                image_buffer = io.BytesIO(image_bytes)
                try:
                    img = Image(image_buffer, width=5 * inch, height=3.125 * inch)
                    img.hAlign = "CENTER"
                    story_elements.append(Spacer(1, 0.2 * inch))
                    story_elements.append(KeepTogether([
                        img,
                        Paragraph(f"Scene {scene_number}", caption_style),
                    ]))
                except Exception as exc:
                    logger.warning(f"[StoryExport] Could not embed scene {scene_number} image in PDF: {exc}")

    doc.build(story_elements)
    return buffer.getvalue()


@router.post("/export-pdf")
async def export_story_pdf(
    request: StoryExportRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> StreamingResponse:
    """Export the story content and scene images as a PDF."""
    user_id = require_authenticated_user(current_user)
    base_name = _safe_filename(request.story_title)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    pdf_name = f"{base_name}_{timestamp}.pdf"

    try:
        pdf_bytes = _build_pdf(request, user_id)
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{pdf_name}"'},
        )
    except Exception as exc:
        logger.error(f"[StoryExport] PDF export failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export story PDF: {exc}",
        )
