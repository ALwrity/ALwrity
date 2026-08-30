"""
Podcast API Models

All Pydantic request/response models for podcast endpoints.
"""

from pydantic import BaseModel, Field, model_validator
from typing import List, Optional, Dict, Any, Literal
from datetime import datetime
from enum import Enum


class PodcastProjectResponse(BaseModel):
    """Response model for podcast project."""
    id: int
    project_id: str
    user_id: str
    idea: str
    duration: int
    speakers: int
    budget_cap: float
    analysis: Optional[Dict[str, Any]] = None
    queries: Optional[List[Dict[str, Any]]] = None
    selected_queries: Optional[List[str]] = None
    research: Optional[Dict[str, Any]] = None
    raw_research: Optional[Dict[str, Any]] = None
    estimate: Optional[Dict[str, Any]] = None
    script_data: Optional[Dict[str, Any]] = None
    bible: Optional[Dict[str, Any]] = None
    render_jobs: Optional[List[Dict[str, Any]]] = None
    knobs: Optional[Dict[str, Any]] = None
    research_provider: Optional[str] = None
    show_script_editor: bool = False
    show_render_queue: bool = False
    current_step: Optional[str] = None
    status: str = "draft"
    is_favorite: bool = False
    final_video_url: Optional[str] = None
    avatar_url: Optional[str] = None
    avatar_prompt: Optional[str] = None
    avatar_persona_id: Optional[str] = None
    presenter_reference_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class PodcastAnalyzeRequest(BaseModel):
    """Request model for podcast idea analysis."""
    idea: str = Field(..., description="Podcast topic or idea")
    duration: int = Field(default=10, description="Target duration in minutes")
    speakers: int = Field(default=1, description="Number of speakers")
    bible: Optional[Dict[str, Any]] = Field(None, description="Optional Podcast Bible for context")
    avatar_url: Optional[str] = Field(None, description="Current avatar URL if selected")
    presenter_reference_url: Optional[str] = Field(None, description="Current presenter reference image URL if generated")
    feedback: Optional[str] = Field(None, description="User feedback for regeneration")
    podcast_mode: Optional[str] = Field(None, description="Podcast mode: audio_only, video_only, or audio_video")


class PodcastAnalyzeResponse(BaseModel):
    """Response model for podcast idea analysis."""
    audience: str
    content_type: str
    top_keywords: list[str]
    suggested_outlines: list[Dict[str, Any]]
    title_suggestions: list[str]
    episode_hook: Optional[str] = None
    key_takeaways: Optional[list[str]] = None
    guest_talking_points: Optional[list[str]] = None
    listener_cta: Optional[str] = None
    research_queries: Optional[List[Dict[str, str]]] = None
    exa_suggested_config: Optional[Dict[str, Any]] = None
    bible: Optional[Dict[str, Any]] = None
    avatar_url: Optional[str] = None
    avatar_prompt: Optional[str] = None
    presenter_reference_url: Optional[str] = None
    estimate: Optional[Dict[str, Any]] = None


class PodcastEnhanceIdeaRequest(BaseModel):
    """Request model for enhancing a podcast idea with AI."""
    idea: str = Field(..., description="The raw podcast idea or keywords")
    bible: Optional[Dict[str, Any]] = Field(None, description="Optional Podcast Bible for context")
    website_data: Optional[Dict[str, Any]] = Field(
        None, 
        description="Optional website extraction data for enriched context (title, summary, highlights, subpages, url)"
    )
    topic_context: Optional[Dict[str, Any]] = Field(
        None,
        description="Optional category research context (category, topics, selected_topic)"
    )


class PodcastEnhanceIdeaResponse(BaseModel):
    """Response model for enhanced podcast idea."""
    enhanced_ideas: List[str] = Field(..., description="3 AI-enhanced topic choices")
    rationales: List[str] = Field(..., description="Rationale for each enhanced idea")


class PodcastScriptRequest(BaseModel):
    """Request model for podcast script generation."""
    idea: str = Field(..., description="Podcast idea or topic")
    duration_minutes: int = Field(default=10, description="Target duration in minutes")
    speakers: int = Field(default=1, description="Number of speakers")
    research: Optional[Dict[str, Any]] = Field(None, description="Optional research payload to ground the script")
    bible: Optional[Dict[str, Any]] = Field(None, description="Podcast Bible for hyper-personalization")
    outline: Optional[Dict[str, Any]] = Field(None, description="The refined episode outline to follow")
    analysis: Optional[Dict[str, Any]] = Field(None, description="The full analysis context (audience, keywords, etc.)")
    podcast_mode: Optional[str] = Field(default="video_only", description="Podcast mode: audio_only, video_only, or audio_video")


class PodcastSceneLine(BaseModel):
    speaker: str
    text: str
    emphasis: Optional[bool] = False
    id: Optional[str] = None  # Optional line ID for frontend tracking
    usedFactIds: Optional[List[str]] = None  # Facts referenced in this line
    ttsHints: Optional[List[str]] = None  # Optional TTS hints, e.g. pause_300ms, smile, emphasize_data


class PodcastScene(BaseModel):
    id: str
    title: str
    duration: int
    lines: list[PodcastSceneLine]
    approved: bool = False
    emotion: Optional[str] = None
    camera_angle: Optional[str] = "medium_shot"  # wide_shot | medium_shot | close_up | over_shoulder
    visual_atmosphere: Optional[str] = ""  # e.g. "dim blue-lit studio, contemplative"
    imageUrl: Optional[str] = None  # Generated image URL for video generation
    audioUrl: Optional[str] = None  # Generated audio URL for this scene
    imagePrompt: Optional[str] = None  # Original image generation prompt for video context
    chart_data: Optional[Dict[str, Any]] = None  # Optional chart mapping for B-roll scenes


class PodcastExaConfig(BaseModel):
    """Exa config for podcast research."""
    exa_search_type: Optional[str] = Field(default="auto", description="auto | keyword | neural")
    exa_category: Optional[str] = None
    exa_include_domains: List[str] = []
    exa_exclude_domains: List[str] = []
    max_sources: int = 8
    include_statistics: Optional[bool] = False
    date_range: Optional[str] = Field(default=None, description="last_month | last_3_months | last_year | all_time")

    @model_validator(mode="after")
    def validate_domains(self):
        if self.exa_include_domains and self.exa_exclude_domains:
            # Exa API does not allow both include and exclude domains together with contents
            # Prefer include_domains and drop exclude_domains
            self.exa_exclude_domains = []
        return self


class PodcastExaResearchRequest(BaseModel):
    """Request for podcast research using Exa directly (no blog writer)."""
    topic: str
    queries: List[str]
    exa_config: Optional[PodcastExaConfig] = None
    bible: Optional[Dict[str, Any]] = Field(None, description="Podcast Bible for hyper-personalization")
    analysis: Optional[Dict[str, Any]] = Field(None, description="Podcast analysis context (audience, content type, etc.)")


class PodcastExaSource(BaseModel):
    title: str = ""
    url: str = ""
    excerpt: str = ""
    published_at: Optional[str] = None
    publishedDate: Optional[str] = None  # Exa format
    highlights: Optional[List[str]] = None
    summary: Optional[str] = None
    source_type: Optional[str] = None
    index: Optional[int] = None
    image: Optional[str] = None
    author: Optional[str] = None
    text: Optional[str] = None  # Exa full text
    credibility_score: Optional[float] = None  # Exa scores


class PodcastResearchInsight(BaseModel):
    """Deep insight extracted from research."""
    title: str
    content: str
    source_indices: List[int] = []
    podcast_talking_points: Optional[List[str]] = []  # Talking points for host to expand on
    expert_quotes: Optional[List[Dict[str, str]]] = []  # Quotes from sources
    listener_cta_suggestions: Optional[List[str]] = []  # CTA suggestions


class PodcastResearchOutput(BaseModel):
    """Structured JSON output for LLM research extraction using json_struct."""
    summary: str = ""
    key_insights: List[PodcastResearchInsight] = []
    expert_quotes: List[Dict[str, Any]] = []  # [{"quote": str, "source_index": int, "context": str}]
    listener_cta_suggestions: List[str] = []  # List of CTA suggestions
    mapped_angles: List[Dict[str, Any]] = []  # [{"title": str, "why": str, "mapped_fact_ids": []}]


class PodcastCostBreakdownItem(BaseModel):
    phase: Literal["Analyze", "Gather", "Write", "Produce"]
    cost: float


class PodcastCostEst(BaseModel):
    total: float
    breakdown: List[PodcastCostBreakdownItem]
    currency: Literal["USD"] = "USD"
    last_updated: datetime


class PodcastExaResearchResponse(BaseModel):
    sources: List[PodcastExaSource]
    search_queries: List[str] = []
    summary: str = ""
    key_insights: List[PodcastResearchInsight] = []
    cost_est: PodcastCostEst
    search_type: Optional[str] = None
    provider: str = "exa"
    content: Optional[str] = None  # Raw aggregated content (deprecated)
    mapped_angles: List[Dict[str, Any]] = []  # Content angles for the episode
    expert_quotes: List[Dict[str, Any]] = []  # Expert quotes from research
    listener_cta_suggestions: List[str] = []  # CTA suggestions
    estimate: Optional[Dict[str, Any]] = None


class PodcastScriptResponse(BaseModel):
    scenes: list[PodcastScene]


class PodcastAudioRequest(BaseModel):
    """Generate TTS for a podcast scene."""
    scene_id: str
    scene_title: str
    text: str
    voice_id: Optional[str] = "Wise_Woman"
    custom_voice_id: Optional[str] = None  # Voice clone ID for custom voice
    use_voice_clone: Optional[bool] = False  # If True, use voice clone with voice_sample_url
    voice_sample_url: Optional[str] = None  # URL to user's voice sample for cloning
    voice_clone_engine: Optional[str] = None  # Engine: "qwen3", "minimax", "cosyvoice"
    speed: Optional[float] = 1.0
    volume: Optional[float] = 1.0
    pitch: Optional[float] = 0.0
    emotion: Optional[str] = "neutral"
    english_normalization: Optional[bool] = False  # Better number reading for statistics
    sample_rate: Optional[int] = None
    bitrate: Optional[int] = None
    channel: Optional[str] = None
    format: Optional[str] = None
    language_boost: Optional[str] = None
    enable_sync_mode: Optional[bool] = True


class PodcastAudioResponse(BaseModel):
    scene_id: str
    scene_title: str
    audio_filename: str
    audio_url: str
    provider: str
    model: str
    voice_id: str
    text_length: int
    file_size: int
    cost: float


class PodcastProjectListResponse(BaseModel):
    """Response model for project list."""
    projects: List[PodcastProjectResponse]
    total: int
    limit: int
    offset: int


class CreateProjectRequest(BaseModel):
    """Request model for creating a project."""
    project_id: str = Field(..., description="Unique project ID")
    idea: str = Field(..., description="Episode idea or URL")
    duration: int = Field(..., description="Duration in minutes")
    speakers: int = Field(default=1, description="Number of speakers")
    budget_cap: float = Field(default=50.0, description="Budget cap in USD")
    avatar_url: Optional[str] = Field(None, description="Optional presenter avatar URL")
    presenter_reference_url: Optional[str] = Field(None, description="Optional presenter reference image URL")


class UpdateProjectRequest(BaseModel):
    """Request model for updating project state."""
    analysis: Optional[Dict[str, Any]] = None
    queries: Optional[List[Dict[str, Any]]] = None
    selected_queries: Optional[List[str]] = None
    research: Optional[Dict[str, Any]] = None
    raw_research: Optional[Dict[str, Any]] = None
    estimate: Optional[Dict[str, Any]] = None
    script_data: Optional[Dict[str, Any]] = None
    bible: Optional[Dict[str, Any]] = None
    render_jobs: Optional[List[Dict[str, Any]]] = None
    knobs: Optional[Dict[str, Any]] = None
    research_provider: Optional[str] = None
    show_script_editor: Optional[bool] = None
    show_render_queue: Optional[bool] = None
    current_step: Optional[str] = None
    status: Optional[str] = None
    final_video_url: Optional[str] = None
    presenter_reference_url: Optional[str] = None


class PodcastCombineAudioRequest(BaseModel):
    """Request model for combining podcast audio files."""
    project_id: str
    scene_ids: List[str] = Field(..., description="List of scene IDs to combine")
    scene_audio_urls: List[str] = Field(..., description="List of audio URLs for each scene")


class PodcastCombineAudioResponse(BaseModel):
    """Response model for combined podcast audio."""
    combined_audio_url: str
    combined_audio_filename: str
    total_duration: float
    file_size: int
    scene_count: int


class PodcastImageRequest(BaseModel):
    """Request for generating an image for a podcast scene."""
    scene_id: str
    scene_title: str
    project_id: Optional[str] = None  # Optional: podcast project ID for session character locking
    scene_content: Optional[str] = None  # Optional: scene lines text for context
    scene_emotion: Optional[str] = None  # Optional: scene emotion for visual tone
    camera_angle: Optional[str] = "medium_shot"  # wide_shot | medium_shot | close_up | over_shoulder
    visual_atmosphere: Optional[str] = ""  # e.g. "dim blue-lit studio, contemplative"
    idea: Optional[str] = None  # Optional: podcast idea for context
    analysis: Optional[Dict[str, Any]] = Field(None, description="AI analysis for visual context (keywords, audience)")
    base_avatar_url: Optional[str] = None  # Base avatar image URL for scene variations
    bible: Optional[Dict[str, Any]] = Field(None, description="Podcast Bible for hyper-personalization")
    width: int = 1024
    height: int = 1024
    custom_prompt: Optional[str] = None  # Custom prompt from user (overrides auto-generated prompt)
    style: Optional[str] = None  # "Auto", "Fiction", or "Realistic"
    rendering_speed: Optional[str] = None  # "Default", "Turbo", or "Quality"
    aspect_ratio: Optional[str] = None  # "1:1", "16:9", "9:16", "4:3", "3:4"


class PodcastImageResponse(BaseModel):
    """Response for podcast scene image generation."""
    scene_id: str
    scene_title: str
    image_filename: str
    image_url: str
    width: int
    height: int
    provider: str
    model: Optional[str] = None
    cost: float
    image_prompt: Optional[str] = None  # Return the prompt used for generation


class PresenterReferenceRequest(BaseModel):
    """Request to generate (or retrieve) the base presenter reference image for an episode.

    This image is generated once at the start of an episode and used as an
    image-to-image anchor for all subsequent scene generations, eliminating
    per-scene character drift.
    """
    project_id: str
    bible: Optional[Dict[str, Any]] = Field(None, description="Podcast Bible for host appearance")
    idea: Optional[str] = None
    force_regenerate: bool = False  # If True, regenerate even if a reference already exists
    style_index: Optional[int] = None  # Optional specific character style index for re-rolling (0-4)



class PresenterReferenceResponse(BaseModel):
    """Response for presenter reference image generation."""
    project_id: str
    reference_url: str    # Served via /api/podcast/images/<filename>
    was_cached: bool      # True if an existing reference was returned without regeneration




class PodcastVideoGenerationRequest(BaseModel):
    """Request model for podcast video generation."""
    project_id: str = Field(..., description="Podcast project ID")
    scene_id: str = Field(..., description="Scene ID")
    scene_title: str = Field(..., description="Scene title")
    audio_url: str = Field(..., description="URL to the generated audio file")
    avatar_image_url: Optional[str] = Field(None, description="URL to scene image (required for video generation)")
    bible: Optional[Dict[str, Any]] = Field(None, description="Podcast Bible for hyper-personalization")
    analysis: Optional[Dict[str, Any]] = Field(None, description="Podcast Analysis for context (content type, audience, takeaways, guest)")
    scene_image_prompt: Optional[str] = Field(None, description="Original image generation prompt for visual context")
    scene_narration: Optional[str] = Field(None, description="Scene narration/script lines for context")
    resolution: str = Field("720p", description="Video resolution (480p or 720p)")
    prompt: Optional[str] = Field(None, description="Optional animation prompt override")
    seed: Optional[int] = Field(-1, description="Random seed; -1 for random")
    mask_image_url: Optional[str] = Field(None, description="Optional mask image URL to specify animated region")
    scene_emotion: Optional[str] = Field(None, description="Scene emotion (e.g. excited, serious, curious) for InfiniteTalk prompt")
    scene_visual_atmosphere: Optional[str] = Field(None, description="Scene visual atmosphere / lighting mood for InfiniteTalk prompt")


class PodcastVideoGenerationResponse(BaseModel):
    """Response model for podcast video generation."""
    task_id: str
    status: str
    message: str


class PodcastCombineVideosRequest(BaseModel):
    """Request to combine scene videos into final podcast"""
    project_id: str = Field(..., description="Project ID")
    scene_video_urls: list[str] = Field(..., description="List of scene video URLs in order")
    podcast_title: str = Field(default="Podcast", description="Title for the final podcast video")


class PodcastCombineVideosResponse(BaseModel):
    """Response from combine videos endpoint"""
    task_id: str
    status: str
    message: str


class AudioDubbingQuality(str, Enum):
    LOW = "low"
    HIGH = "high"
    
    @classmethod
    def from_string(cls, value: str) -> "AudioDubbingQuality":
        if value.lower() == "high":
            return cls.HIGH
        return cls.LOW


class PodcastAudioDubRequest(BaseModel):
    """Request model for audio dubbing."""
    source_audio_url: str = Field(..., description="URL or path to source audio file")
    source_language: Optional[str] = Field(None, description="Source language code (auto-detected if None)")
    target_language: str = Field(..., description="Target language for dubbing")
    quality: str = Field(default="low", description="Translation quality: low (DeepL) or high (WaveSpeed)")
    voice_id: Optional[str] = Field(default="Wise_Woman", description="Voice ID for TTS")
    speed: Optional[float] = Field(default=1.0, ge=0.5, le=2.0, description="Speech speed (0.5-2.0)")
    emotion: Optional[str] = Field(default="happy", description="Emotion for TTS voice")
    preserve_emotion: Optional[bool] = Field(default=True, description="Preserve emotional tone in translation")
    use_voice_clone: Optional[bool] = Field(default=False, description="Use voice cloning to preserve original speaker's voice")
    custom_voice_id: Optional[str] = Field(None, description="Custom name for the cloned voice")
    voice_clone_accuracy: Optional[float] = Field(default=0.7, ge=0.1, le=1.0, description="Voice cloning accuracy (0.1-1.0)")


class PodcastAudioDubResponse(BaseModel):
    """Response model for audio dubbing task creation."""
    task_id: str
    status: str = "pending"
    message: str = "Audio dubbing task created"


class PodcastAudioDubResult(BaseModel):
    """Response model for completed audio dubbing."""
    dubbed_audio_url: str
    dubbed_audio_filename: str
    original_transcript: str
    translated_transcript: str
    source_language: str
    target_language: str
    voice_id: str
    quality: str
    duration_seconds: int
    file_size: int
    cost: float
    task_id: str
    status: str = "completed"
    voice_clone_used: Optional[bool] = Field(default=False, description="Whether voice cloning was used")
    cloned_voice_id: Optional[str] = Field(None, description="ID of the cloned voice if voice_clone_used=True")


class PodcastAudioDubEstimateRequest(BaseModel):
    """Request model for dubbing cost estimation."""
    audio_duration_seconds: float = Field(..., description="Duration of source audio in seconds")
    target_language: str = Field(..., description="Target language")
    quality: str = Field(default="low", description="Translation quality")
    use_voice_clone: Optional[bool] = Field(default=False, description="Include voice cloning cost")


class PodcastAudioDubEstimateResponse(BaseModel):
    """Response model for dubbing cost estimation."""
    estimated_characters: int
    translation_cost: float
    tts_cost: float
    voice_clone_cost: float = 0.0
    total_cost: float
    currency: str = "USD"


class VoiceCloneRequest(BaseModel):
    """Request model for voice cloning."""
    source_audio_url: str = Field(..., description="URL or path to source audio file (10-60 seconds recommended)")
    custom_voice_id: Optional[str] = Field(None, description="Custom name for the cloned voice")
    accuracy: Optional[float] = Field(default=0.7, ge=0.1, le=1.0, description="Cloning accuracy (0.1-1.0)")
    language_boost: Optional[str] = Field(None, description="Language to optimize the voice for")


class VoiceCloneResponse(BaseModel):
    """Response model for voice cloning."""
    task_id: str
    status: str = "pending"
    message: str = "Voice cloning task created"


class VoiceCloneResult(BaseModel):
    """Response model for completed voice cloning."""
    voice_id: str
    voice_url: str
    source_language: str
    accuracy: float
    file_size: int
    task_id: str
    status: str = "completed"


class ExtractUrlRequest(BaseModel):
    """Request to extract content from a URL using Exa."""
    url: str = Field(..., description="URL to extract content from")


class ExtractUrlResponse(BaseModel):
    """Response with extracted content from URL."""
    success: bool
    title: Optional[str] = None
    text: Optional[str] = None
    summary: Optional[str] = None
    author: Optional[str] = None
    highlights: Optional[List[str]] = Field(default_factory=list, description="Key highlights from the content")
    url: str
    image: Optional[str] = None
    favicon: Optional[str] = None
    subpages: Optional[List[Dict[str, Any]]] = Field(default_factory=list, description="Subpages with their own content")
    error: Optional[str] = None


class WebsiteAnalysisRequest(BaseModel):
    """Request to save user's website analysis."""
    website_url: str = Field(..., description="The website URL")
    exa_content: Dict[str, Any] = Field(default_factory=dict, description="Exa extracted content")


class WebsiteAnalysisResponse(BaseModel):
    """Response for website analysis."""
    success: bool
    website_url: Optional[str] = None
    message: Optional[str] = None
    error: Optional[str] = None


class PodcastPreEstimateRequest(BaseModel):
    """Request model for pre-analysis cost estimate."""
    duration: int = Field(default=10, description="Target duration in minutes")
    speakers: int = Field(default=1, description="Number of speakers")
    query_count: int = Field(default=3, description="Number of research queries")
    podcast_mode: str = Field(default="audio_video", description="Podcast mode: audio_only, video_only, or audio_video")
    # Optional model overrides for cost estimation
    gemini_model: Optional[str] = Field(default=None, description="LLM model: gemini-2.5-flash, gemini-1.5-flash, etc.")
    audio_tts_model: Optional[str] = Field(default=None, description="Audio TTS model: minimax/speech-02-hd")
    voice_clone_engine: Optional[str] = Field(default=None, description="Voice clone engine: qwen3, cosyvoice, minimax")
    image_model: Optional[str] = Field(default=None, description="Image model: qwen-image, ideogram-v3-turbo")
    video_model: Optional[str] = Field(default=None, description="Video model: wan-2.5, kling-v2.5-turbo-std-5s, wavespeed-ai/infinitetalk")


class PodcastPreEstimateResponse(BaseModel):
    """Response model for pre-analysis cost estimate."""
    estimate: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    pricing_available: bool = Field(default=False, description="Whether pricing data is available in DB")
    debug: Optional[Dict[str, Any]] = Field(default=None, description="Debug info: pricing rows count, providers")
