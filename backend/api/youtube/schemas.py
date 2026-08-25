"""YouTube Creator API request/response schemas."""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator


class VideoPlanRequest(BaseModel):
    """Request model for video planning."""
    user_idea: str = Field(..., description="User's video idea or topic")
    duration_type: str = Field(
        ...,
        pattern="^(shorts|medium|long)$",
        description="Video duration type: shorts (≤60s), medium (1-4min), long (4-10min)"
    )
    video_type: Optional[str] = Field(
        None,
        pattern="^(tutorial|review|educational|entertainment|vlog|product_demo|reaction|storytelling)$",
        description="Video format type: tutorial, review, educational, entertainment, vlog, product_demo, reaction, storytelling"
    )
    target_audience: Optional[str] = Field(
        None,
        description="Target audience description (helps optimize tone, pace, and style)"
    )
    video_goal: Optional[str] = Field(
        None,
        description="Primary goal of the video (educate, sell, entertain, etc.)"
    )
    brand_style: Optional[str] = Field(
        None,
        description="Brand visual aesthetic and style preferences"
    )
    reference_image_description: Optional[str] = Field(
        None,
        description="Optional description of reference image for visual inspiration"
    )
    source_content_id: Optional[str] = Field(
        None,
        description="Optional ID of source content (blog/story) to convert"
    )
    source_content_type: Optional[str] = Field(
        None,
        pattern="^(blog|story)$",
        description="Type of source content: blog or story"
    )
    source_article_url: Optional[str] = Field(
        None,
        description="Optional extracted article URL used as video source"
    )
    source_article_title: Optional[str] = Field(
        None,
        description="Optional extracted article title"
    )
    source_article_summary: Optional[str] = Field(
        None,
        description="Optional extracted article summary (or truncated text)"
    )
    avatar_url: Optional[str] = Field(
        None,
        description="Optional avatar URL if user uploaded one before plan generation"
    )
    enable_research: Optional[bool] = Field(
        True,
        description="Enable Exa research to enhance plan with current information, trends, and better SEO keywords (default: True)"
    )
    language: Optional[str] = Field(
        None,
        max_length=16,
        description="Content language code from Plan Your Video (e.g. en, hi). Used by pitch/expand prompts.",
    )

    @field_validator("language", mode="before")
    @classmethod
    def normalize_language(cls, value: Any) -> Optional[str]:
        if value is None:
            return None
        text = str(value).strip()
        if not text:
            return None
        return text[:16]


class VideoPlanResponse(BaseModel):
    """Response model for video plan."""
    success: bool
    plan: Optional[Dict[str, Any]] = None
    message: str


class PitchRequest(VideoPlanRequest):
    """Phase 1: idea + creative angle → one lightweight pitch."""
    creative_angle: str = Field(
        ...,
        min_length=1,
        description="User-selected strategy angle (preset or custom)",
    )


class PitchResponse(BaseModel):
    """Response model for pitch generation."""
    success: bool
    pitch: Optional[Dict[str, Any]] = None
    message: str


class ExpandRequest(VideoPlanRequest):
    """Phase 2: approved pitch → full production script."""
    approved_pitch: Dict[str, Any] = Field(
        ...,
        description="Approved pitch payload (title, summary, hook, beats, angle)",
    )


class ExpandResponse(BaseModel):
    """Response model for pitch expansion."""
    success: bool
    expansion: Optional[Dict[str, Any]] = None
    full_script: Optional[str] = None
    message: str


class SceneBuildRequest(BaseModel):
    """Request model for scene building."""
    video_plan: Dict[str, Any] = Field(..., description="Video plan from planning endpoint")
    custom_script: Optional[str] = Field(
        None,
        description="Optional custom script to use instead of generating from plan"
    )


class SceneBuildResponse(BaseModel):
    """Response model for scene building."""
    success: bool
    scenes: List[Dict[str, Any]] = []
    generation: Optional[Dict[str, Any]] = None
    message: str


class SceneUpdateRequest(BaseModel):
    """Request model for updating a single scene."""
    scene_id: int = Field(..., description="Scene number to update")
    narration: Optional[str] = None
    visual_description: Optional[str] = None
    duration_estimate: Optional[float] = None
    enabled: Optional[bool] = None


class SceneUpdateResponse(BaseModel):
    """Response model for scene update."""
    success: bool
    scene: Optional[Dict[str, Any]] = None
    message: str


class VideoRenderRequest(BaseModel):
    """Request model for video rendering."""
    scenes: List[Dict[str, Any]] = Field(..., description="List of scenes to render")
    video_plan: Dict[str, Any] = Field(..., description="Original video plan")
    resolution: str = Field("720p", pattern="^(480p|720p|1080p)$", description="Video resolution")
    combine_scenes: bool = Field(True, description="Whether to combine scenes into single video")
    voice_id: str = Field("Wise_Woman", description="Voice ID for narration")


class SceneVideoRenderRequest(BaseModel):
    """Request model for rendering a single scene video."""
    scene: Dict[str, Any] = Field(..., description="Single scene data to render")
    video_plan: Dict[str, Any] = Field(..., description="Original video plan (context)")
    resolution: str = Field("720p", pattern="^(480p|720p|1080p)$", description="Video resolution")
    voice_id: str = Field("Wise_Woman", description="Voice ID for narration")
    generate_audio_enabled: bool = Field(False, description="Whether to auto-generate audio if missing (default false)")


class SceneVideoRenderResponse(BaseModel):
    """Response model for single scene video rendering."""
    success: bool
    task_id: Optional[str] = None
    message: str
    scene_number: Optional[int] = None


class CombineVideosRequest(BaseModel):
    """Request model for combining multiple scene videos."""
    scene_video_urls: List[str] = Field(..., description="List of scene video URLs to combine in order")
    video_plan: Optional[Dict[str, Any]] = Field(None, description="Original video plan (for metadata)")
    resolution: str = Field("720p", pattern="^(480p|720p|1080p)$", description="Target resolution for output")
    title: Optional[str] = Field(None, description="Optional title for the combined video")


class CombineVideosResponse(BaseModel):
    """Response model for combine videos request."""
    success: bool
    task_id: Optional[str] = None
    message: str


class VideoListResponse(BaseModel):
    """Response model for listing user videos."""
    videos: List[Dict[str, Any]]
    success: bool = True
    message: str = "Videos fetched successfully"


class VideoRenderResponse(BaseModel):
    """Response model for video rendering."""
    success: bool
    task_id: Optional[str] = None
    message: str


class CostEstimateRequest(BaseModel):
    """Request model for cost estimation."""
    scenes: List[Dict[str, Any]] = Field(..., description="List of scenes to estimate")
    resolution: str = Field("720p", pattern="^(480p|720p|1080p)$", description="Video resolution")
    image_model: Optional[str] = Field("ideogram-v3-turbo", description="Image generation model")


class CostEstimateResponse(BaseModel):
    """Response model for cost estimation."""
    success: bool
    estimate: Optional[Dict[str, Any]] = None
    message: str
