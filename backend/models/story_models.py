"""
Story Writer Models

Pydantic models for story generation API requests and responses.
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Union


class StoryGenerationRequest(BaseModel):
    """Request model for story generation."""
    persona: str = Field(..., description="The persona statement for the author")
    story_setting: str = Field(..., description="The setting of the story")
    character_input: str = Field(..., description="The characters in the story")
    plot_elements: str = Field(..., description="The plot elements of the story")
    writing_style: str = Field(..., description="The writing style (e.g., Formal, Casual, Poetic, Humorous)")
    story_tone: str = Field(..., description="The tone of the story (e.g., Dark, Uplifting, Suspenseful, Whimsical)")
    narrative_pov: str = Field(..., description="The narrative point of view (e.g., First Person, Third Person Limited, Third Person Omniscient)")
    audience_age_group: str = Field(..., description="The target audience age group (e.g., Children, Young Adults, Adults)")
    content_rating: str = Field(..., description="The content rating (e.g., G, PG, PG-13, R)")
    ending_preference: str = Field(..., description="The preferred ending (e.g., Happy, Tragic, Cliffhanger, Twist)")
    story_length: str = Field(default="Medium", description="Target story length (Short: >1000 words, Medium: >5000 words, Long: >10000 words)")
    enable_explainer: bool = Field(default=True, description="Enable explainer features")
    enable_illustration: bool = Field(default=True, description="Enable illustration features")
    enable_video_narration: bool = Field(default=True, description="Enable story video and narration features")
    
    # Image generation settings
    image_provider: Optional[str] = Field(default=None, description="Image generation provider (gemini, huggingface, stability)")
    image_width: int = Field(default=1024, description="Image width in pixels")
    image_height: int = Field(default=1024, description="Image height in pixels")
    image_model: Optional[str] = Field(default=None, description="Image generation model")
    
    # Video generation settings
    video_fps: int = Field(default=24, description="Frames per second for video")
    video_transition_duration: float = Field(default=0.5, description="Duration of transitions between scenes in seconds")
    
    # Audio generation settings
    audio_provider: Optional[str] = Field(default="gtts", description="TTS provider (gtts, pyttsx3)")
    audio_lang: str = Field(default="en", description="Language code for TTS")
    audio_slow: bool = Field(default=False, description="Whether to speak slowly (gTTS only)")
    audio_rate: int = Field(default=150, description="Speech rate (pyttsx3 only)")
    anime_bible: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Optional structured anime story bible for anime fiction templates",
    )


class StorySetupGenerationRequest(BaseModel):
    """Request model for AI story setup generation."""
    story_idea: str = Field(..., description="Basic story idea or information from the user")
    story_mode: Optional[str] = Field(
        default=None,
        description="Story mode (marketing or pure) if provided by the UI",
    )
    story_template: Optional[str] = Field(
        default=None,
        description="Optional story template identifier (e.g. product_story, brand_manifesto)",
    )
    brand_context: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Optional high-signal brand context derived from onboarding",
    )


class StoryIdeaEnhanceRequest(BaseModel):
    """Request model for AI story idea enhancement."""
    story_idea: str = Field(..., description="Original story idea or concept text from the user")
    story_mode: Optional[str] = Field(
        default=None,
        description="Story mode (marketing or pure) if provided by the UI",
    )
    story_template: Optional[str] = Field(
        default=None,
        description="Optional story template identifier (e.g. product_story, brand_manifesto)",
    )
    brand_context: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Optional high-signal brand context derived from onboarding",
    )

    fiction_variant: Optional[str] = Field(
        default=None,
        description="Optional fiction-specific focus label (e.g. high-concept twist, shonen action)",
    )
    narrative_energy: Optional[str] = Field(
        default=None,
        description="Optional narrative energy or pacing hint (e.g. grounded, balanced, cinematic)",
    )
    fiction_variant_description: Optional[str] = Field(
        default=None,
        description="Optional description of the fiction variant for richer LLM context",
    )
    narrative_energy_description: Optional[str] = Field(
        default=None,
        description="Optional description of the narrative energy for richer LLM context",
    )


class StorySetupOption(BaseModel):
    """A single story setup option."""
    persona: str = Field(..., description="The persona statement for the author")
    story_setting: str = Field(..., description="The setting of the story")
    character_input: str = Field(..., description="The characters in the story")
    plot_elements: str = Field(..., description="The plot elements of the story")
    writing_style: str = Field(..., description="The writing style")
    story_tone: str = Field(..., description="The tone of the story")
    narrative_pov: str = Field(..., description="The narrative point of view")
    audience_age_group: str = Field(..., description="The target audience age group")
    content_rating: str = Field(..., description="The content rating")
    ending_preference: str = Field(..., description="The preferred ending")
    story_length: str = Field(default="Medium", description="Target story length (Short: >1000 words, Medium: >5000 words, Long: >10000 words)")
    premise: str = Field(..., description="The story premise (1-2 sentences)")
    reasoning: str = Field(..., description="Brief reasoning for this setup option")
    
    # Image generation settings
    image_provider: Optional[str] = Field(default=None, description="Image generation provider (gemini, huggingface, stability)")
    image_width: int = Field(default=1024, description="Image width in pixels")
    image_height: int = Field(default=1024, description="Image height in pixels")
    image_model: Optional[str] = Field(default=None, description="Image generation model")
    
    # Video generation settings
    video_fps: int = Field(default=24, description="Frames per second for video")
    video_transition_duration: float = Field(default=0.5, description="Duration of transitions between scenes in seconds")
    
    # Audio generation settings
    audio_provider: Optional[str] = Field(default="gtts", description="TTS provider (gtts, pyttsx3)")
    audio_lang: str = Field(default="en", description="Language code for TTS")
    audio_slow: bool = Field(default=False, description="Whether to speak slowly (gTTS only)")
    audio_rate: int = Field(default=150, description="Speech rate (pyttsx3 only)")
    anime_bible: Optional["AnimeStoryBible"] = Field(
        default=None,
        description="Optional structured anime story bible for anime fiction templates",
    )


class AnimeCharacter(BaseModel):
    id: str = Field(..., description="Stable identifier for the character (snake_case)")
    name: str = Field(..., description="Character name")
    age_range: str = Field(..., description="Approximate age range (e.g., 'late teens', '30s')")
    role: str = Field(..., description="Narrative role (protagonist, antagonist, mentor, etc.)")
    look: str = Field(..., description="Key visual details (hair, build, notable traits)")
    outfit_palette: str = Field(..., description="Main outfit colors and style")
    personality_tags: List[str] = Field(default_factory=list, description="Short tags describing personality")


class AnimeWorld(BaseModel):
    setting: str = Field(..., description="World description and primary locations")
    era: str = Field(..., description="Time period (near-future, far future, alt 1990s, etc.)")
    tech_or_magic_level: str = Field(..., description="Technology or magic sophistication level")
    core_rules: List[str] = Field(default_factory=list, description="Key world rules and constraints")


class AnimeVisualStyle(BaseModel):
    style_preset: str = Field(..., description="High level style preset (anime_manga, cinematic_anime, cozy_slice_of_life)")
    camera_style: str = Field(..., description="Typical camera behaviour and framing")
    color_mood: str = Field(..., description="Dominant color palette and contrast")
    lighting: str = Field(..., description="Lighting style")
    line_style: str = Field(..., description="Line art style (thick, thin, rough, etc.)")
    extra_tags: List[str] = Field(default_factory=list, description="Additional style tags")


class AnimeStoryBible(BaseModel):
    story_id: Optional[str] = Field(default=None, description="Optional story identifier")
    main_cast: List[AnimeCharacter] = Field(default_factory=list, description="Main cast of characters")
    world: AnimeWorld = Field(..., description="World and rules description")
    visual_style: AnimeVisualStyle = Field(..., description="Visual style anchors for images and video")


class StorySetupGenerationResponse(BaseModel):
    """Response model for story setup generation."""
    options: List[StorySetupOption] = Field(..., description="Three story setup options")
    success: bool = Field(default=True, description="Whether the generation was successful")


class StoryIdeaEnhanceSuggestion(BaseModel):
    """A single enhanced story idea suggestion."""
    idea: str = Field(..., description="AI-enhanced story idea text")
    whats_missing: str = Field(
        ...,
        description="Concise explanation of missing or underspecified plot/context elements",
    )
    why_choose: str = Field(
        ...,
        description="Why this idea is a strong direction based on the original input",
    )


class StoryIdeaEnhanceResponse(BaseModel):
    """Response model for story idea enhancement."""
    suggestions: List[StoryIdeaEnhanceSuggestion] = Field(
        ..., description="List of enhanced story idea suggestions"
    )
    success: bool = Field(default=True, description="Whether the enhancement was successful")


class StoryScene(BaseModel):
    scene_number: int = Field(..., description="Scene number")
    title: str = Field(..., description="Scene title")
    description: str = Field(..., description="Scene description")
    image_prompt: str = Field(..., description="Image prompt for scene visualization")
    audio_narration: str = Field(..., description="Audio narration text for the scene")
    character_descriptions: List[str] = Field(default_factory=list, description="Character descriptions in the scene")
    key_events: List[str] = Field(default_factory=list, description="Key events in the scene")


class AnimeSceneTextRequest(BaseModel):
    scene: StoryScene = Field(..., description="Scene to refine using the anime bible")
    persona: str = Field(..., description="Persona context for the scene")
    story_setting: str = Field(..., description="Story setting")
    character_input: str = Field(..., description="Characters description from story setup")
    plot_elements: str = Field(..., description="Plot elements from story setup")
    writing_style: str = Field(..., description="Writing style")
    story_tone: str = Field(..., description="Story tone")
    narrative_pov: str = Field(..., description="Narrative point of view")
    audience_age_group: str = Field(..., description="Audience age group")
    content_rating: str = Field(..., description="Content rating")
    anime_bible: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Optional anime story bible used to refine the scene",
    )


class AnimeSceneTextResponse(BaseModel):
    scene: StoryScene = Field(..., description="Refined scene with bible-aware text and prompts")
    success: bool = Field(default=True, description="Whether the refinement was successful")


class AnimeSceneGenerateRequest(BaseModel):
    premise: str = Field(..., description="Overall story premise for context")
    persona: str = Field(..., description="Persona context for the scene")
    story_setting: str = Field(..., description="Story setting")
    character_input: str = Field(..., description="Characters description from story setup")
    plot_elements: str = Field(..., description="Plot elements from story setup")
    writing_style: str = Field(..., description="Writing style")
    story_tone: str = Field(..., description="Story tone")
    narrative_pov: str = Field(..., description="Narrative point of view")
    audience_age_group: str = Field(..., description="Audience age group")
    content_rating: str = Field(..., description="Content rating")
    anime_bible: Dict[str, Any] = Field(
        ...,
        description="Anime story bible used as a hard constraint for generation",
    )
    previous_scenes: Optional[List[StoryScene]] = Field(
        default=None,
        description="Optional list of previous scenes for continuity context",
    )
    target_scene_number: Optional[int] = Field(
        default=None,
        description="Optional target scene number for the new scene",
    )


class AnimeSceneGenerateResponse(BaseModel):
    scene: StoryScene = Field(..., description="Newly generated anime scene based on the bible")
    success: bool = Field(default=True, description="Whether the scene generation was successful")


class StoryStartRequest(StoryGenerationRequest):
    """Request model for story start generation."""
    premise: str = Field(..., description="The story premise")
    outline: Union[str, List[StoryScene], List[Dict[str, Any]]] = Field(..., description="The story outline (text or structured scenes)")


class StoryPremiseResponse(BaseModel):
    """Response model for premise generation."""
    premise: str = Field(..., description="Generated story premise")
    success: bool = Field(default=True, description="Whether the generation was successful")
    task_id: Optional[str] = Field(None, description="Task ID for async operations")


class StoryOutlineResponse(BaseModel):
    """Response model for outline generation."""
    outline: Union[str, List[StoryScene]] = Field(..., description="Generated story outline (text or structured scenes)")
    success: bool = Field(default=True, description="Whether the generation was successful")
    task_id: Optional[str] = Field(None, description="Task ID for async operations")
    is_structured: bool = Field(default=False, description="Whether the outline is structured (scenes) or plain text")
    anime_bible: Optional[AnimeStoryBible] = Field(
        default=None,
        description="Optional structured anime story bible generated from final story setup",
    )


class StoryContentResponse(BaseModel):
    """Response model for story content generation."""
    story: str = Field(..., description="Generated story content")
    premise: Optional[str] = Field(None, description="Story premise")
    outline: Optional[str] = Field(None, description="Story outline")
    is_complete: bool = Field(default=False, description="Whether the story is complete")
    iterations: int = Field(default=0, description="Number of continuation iterations")
    success: bool = Field(default=True, description="Whether the generation was successful")
    task_id: Optional[str] = Field(None, description="Task ID for async operations")


class StoryFullGenerationResponse(BaseModel):
    """Response model for full story generation."""
    premise: str = Field(..., description="Generated story premise")
    outline: str = Field(..., description="Generated story outline")
    story: str = Field(..., description="Generated complete story")
    is_complete: bool = Field(default=False, description="Whether the story is complete")
    iterations: int = Field(default=0, description="Number of continuation iterations")
    success: bool = Field(default=True, description="Whether the generation was successful")
    task_id: Optional[str] = Field(None, description="Task ID for async operations")


class StoryContinueRequest(BaseModel):
    """Request model for continuing story generation."""
    premise: str = Field(..., description="The story premise")
    outline: Union[str, List[StoryScene], List[Dict[str, Any]]] = Field(..., description="The story outline (text or structured scenes)")
    story_text: str = Field(..., description="Current story text to continue from")
    persona: str = Field(..., description="The persona statement for the author")
    story_setting: str = Field(..., description="The setting of the story")
    character_input: str = Field(..., description="The characters in the story")
    plot_elements: str = Field(..., description="The plot elements of the story")
    writing_style: str = Field(..., description="The writing style")
    story_tone: str = Field(..., description="The tone of the story")
    narrative_pov: str = Field(..., description="The narrative point of view")
    audience_age_group: str = Field(..., description="The target audience age group")
    content_rating: str = Field(..., description="The content rating")
    ending_preference: str = Field(..., description="The preferred ending")
    story_length: str = Field(default="Medium", description="Target story length (Short: >1000 words, Medium: >5000 words, Long: >10000 words)")
    anime_bible: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Optional structured anime story bible for anime fiction templates",
    )


class StoryContinueResponse(BaseModel):
    """Response model for story continuation."""
    continuation: str = Field(..., description="Generated story continuation")
    is_complete: bool = Field(default=False, description="Whether the story is complete (contains IAMDONE)")
    success: bool = Field(default=True, description="Whether the generation was successful")


class TaskStatus(BaseModel):
    """Task status model."""
    task_id: str = Field(..., description="Task ID")
    status: str = Field(..., description="Task status (pending, processing, completed, failed)")
    progress: Optional[float] = Field(None, description="Progress percentage (0-100)")
    message: Optional[str] = Field(None, description="Progress message")
    progress_messages: Optional[List[Dict[str, Any]]] = Field(None, description="List of progress messages with timestamps")
    result: Optional[Dict[str, Any]] = Field(None, description="Task result when completed")
    error: Optional[str] = Field(None, description="Error message if failed")
    error_status: Optional[int] = Field(None, description="HTTP error status code")
    error_data: Optional[Dict[str, Any]] = Field(None, description="Error details for frontend")
    created_at: Optional[str] = Field(None, description="Task creation timestamp")
    updated_at: Optional[str] = Field(None, description="Task last update timestamp")


class StoryImageGenerationRequest(BaseModel):
    """Request model for image generation."""
    scenes: List[StoryScene] = Field(..., description="List of scenes to generate images for")
    provider: Optional[str] = Field(None, description="Image generation provider (gemini, huggingface, stability)")
    width: Optional[int] = Field(default=1024, description="Image width")
    height: Optional[int] = Field(default=1024, description="Image height")
    model: Optional[str] = Field(None, description="Image generation model")


class StoryImageResult(BaseModel):
    """Model for a generated image result."""
    scene_number: int = Field(..., description="Scene number")
    scene_title: str = Field(..., description="Scene title")
    image_filename: str = Field(..., description="Image filename")
    image_url: str = Field(..., description="Image URL")
    width: int = Field(..., description="Image width")
    height: int = Field(..., description="Image height")
    provider: str = Field(..., description="Image generation provider")
    model: Optional[str] = Field(None, description="Image generation model")
    seed: Optional[int] = Field(None, description="Image generation seed")
    error: Optional[str] = Field(None, description="Error message if generation failed")


class StoryImageGenerationResponse(BaseModel):
    """Response model for image generation."""
    images: List[StoryImageResult] = Field(..., description="List of generated images")
    success: bool = Field(default=True, description="Whether the generation was successful")
    task_id: Optional[str] = Field(None, description="Task ID for async operations")


class RegenerateImageRequest(BaseModel):
    """Request model for regenerating a single scene image with a direct prompt."""
    scene_number: int = Field(..., description="Scene number to regenerate image for")
    scene_title: str = Field(..., description="Scene title")
    prompt: str = Field(..., description="Direct prompt to use for image generation (no AI prompt generation)")
    provider: Optional[str] = Field(None, description="Image generation provider (gemini, huggingface, stability)")
    width: Optional[int] = Field(1024, description="Image width")
    height: Optional[int] = Field(1024, description="Image height")
    model: Optional[str] = Field(None, description="Model to use for image generation")


class RegenerateImageResponse(BaseModel):
    """Response model for regenerated image."""
    scene_number: int = Field(..., description="Scene number")
    scene_title: str = Field(..., description="Scene title")
    image_filename: str = Field(..., description="Generated image filename")
    image_url: str = Field(..., description="Image URL")
    width: int = Field(..., description="Image width")
    height: int = Field(..., description="Image height")
    provider: str = Field(..., description="Provider used")
    model: Optional[str] = Field(None, description="Model used")
    seed: Optional[int] = Field(None, description="Seed used")
    success: bool = Field(default=True, description="Whether the generation was successful")
    error: Optional[str] = Field(None, description="Error message if generation failed")


class StoryAudioGenerationRequest(BaseModel):
    """Request model for audio generation."""
    scenes: List[StoryScene] = Field(..., description="List of scenes to generate audio for")
    provider: Optional[str] = Field(default="gtts", description="TTS provider (gtts, pyttsx3)")
    lang: Optional[str] = Field(default="en", description="Language code for TTS")
    slow: Optional[bool] = Field(default=False, description="Whether to speak slowly (gTTS only)")
    rate: Optional[int] = Field(default=150, description="Speech rate (pyttsx3 only)")


class StoryAudioResult(BaseModel):
    """Model for a generated audio result."""
    scene_number: int = Field(..., description="Scene number")
    scene_title: str = Field(..., description="Scene title")
    audio_filename: str = Field(..., description="Audio filename")
    audio_url: str = Field(..., description="Audio URL")
    provider: str = Field(..., description="TTS provider")
    file_size: int = Field(..., description="Audio file size in bytes")
    error: Optional[str] = Field(None, description="Error message if generation failed")


class StoryAudioGenerationResponse(BaseModel):
    """Response model for audio generation."""
    audio_files: List[StoryAudioResult] = Field(..., description="List of generated audio files")
    success: bool = Field(default=True, description="Whether the generation was successful")
    task_id: Optional[str] = Field(None, description="Task ID for async operations")


class GenerateAIAudioRequest(BaseModel):
    """Request model for generating AI audio for a single scene."""
    scene_number: int = Field(..., description="Scene number to generate audio for")
    scene_title: str = Field(..., description="Scene title")
    text: str = Field(..., description="Text to convert to speech")
    voice_id: Optional[str] = Field("Wise_Woman", description="Voice ID for AI audio generation")
    speed: Optional[float] = Field(1.0, description="Speech speed (0.5-2.0)")
    volume: Optional[float] = Field(1.0, description="Speech volume (0.1-10.0)")
    pitch: Optional[float] = Field(0.0, description="Speech pitch (-12 to 12)")
    emotion: Optional[str] = Field("happy", description="Emotion for speech")


class GenerateAIAudioResponse(BaseModel):
    """Response model for AI audio generation."""
    scene_number: int = Field(..., description="Scene number")
    scene_title: str = Field(..., description="Scene title")
    audio_filename: str = Field(..., description="Generated audio filename")
    audio_url: str = Field(..., description="Audio URL")
    provider: str = Field(..., description="Provider used (wavespeed)")
    model: str = Field(..., description="Model used (minimax/speech-02-hd)")
    voice_id: str = Field(..., description="Voice ID used")
    text_length: int = Field(..., description="Number of characters in text")
    file_size: int = Field(..., description="Audio file size in bytes")
    cost: float = Field(..., description="Cost of generation")
    success: bool = Field(default=True, description="Whether the generation was successful")
    error: Optional[str] = Field(None, description="Error message if generation failed")


class StoryVideoGenerationRequest(BaseModel):
    """Request model for video generation."""
    scenes: List[StoryScene] = Field(..., description="List of scenes to generate video for")
    image_urls: List[str] = Field(..., description="List of image URLs for each scene")
    audio_urls: List[str] = Field(..., description="List of audio URLs for each scene")
    video_urls: Optional[List[Optional[str]]] = Field(None, description="Optional list of animated video URLs (preferred over images)")
    ai_audio_urls: Optional[List[Optional[str]]] = Field(None, description="Optional list of AI audio URLs (preferred over free audio)")
    story_title: Optional[str] = Field(default="Story", description="Title of the story")
    fps: Optional[int] = Field(default=24, description="Frames per second for video")
    transition_duration: Optional[float] = Field(default=0.5, description="Duration of transitions between scenes")


class StoryVideoResult(BaseModel):
    """Model for a generated video result."""
    video_filename: str = Field(..., description="Video filename")
    video_url: str = Field(..., description="Video URL")
    duration: float = Field(..., description="Video duration in seconds")
    fps: int = Field(..., description="Frames per second")
    file_size: int = Field(..., description="Video file size in bytes")
    num_scenes: int = Field(..., description="Number of scenes in the video")
    error: Optional[str] = Field(None, description="Error message if generation failed")


class StoryVideoGenerationResponse(BaseModel):
    """Response model for video generation."""
    video: StoryVideoResult = Field(..., description="Generated video")
    success: bool = Field(default=True, description="Whether the generation was successful")
    task_id: Optional[str] = Field(None, description="Task ID for async operations")


class AnimateSceneRequest(BaseModel):
    """Request model for per-scene animation preview."""
    scene_number: int = Field(..., description="Scene number to animate")
    scene_data: Dict[str, Any] = Field(..., description="Scene data payload")
    story_context: Dict[str, Any] = Field(..., description="Story-wide context used for prompts")
    image_url: str = Field(..., description="Relative URL to the generated scene image")
    duration: int = Field(default=5, description="Animation duration (5 or 10 seconds)")


class AnimateSceneVoiceoverRequest(AnimateSceneRequest):
    """Request model for WaveSpeed InfiniteTalk animation."""
    audio_url: str = Field(..., description="Relative URL to the generated scene audio")
    resolution: Optional[str] = Field("720p", description="Output resolution ('480p' or '720p')")
    prompt: Optional[str] = Field(None, description="Optional positive prompt override")


class AnimateSceneResponse(BaseModel):
    """Response model for scene animation preview."""
    success: bool = Field(default=True, description="Whether the animation succeeded")
    scene_number: int = Field(..., description="Scene number animated")
    video_filename: str = Field(..., description="Stored video filename")
    video_url: str = Field(..., description="API URL to access the animated video")
    duration: int = Field(..., description="Duration of the animation")
    cost: float = Field(..., description="Cost billed for the animation")
    prompt_used: str = Field(..., description="Animation prompt passed to the model")
    provider: str = Field(default="wavespeed", description="Underlying provider used")
    prediction_id: Optional[str] = Field(None, description="WaveSpeed prediction ID for resume operations")


class ResumeSceneAnimationRequest(BaseModel):
    """Request model to resume scene animation download."""
    prediction_id: str = Field(..., description="WaveSpeed prediction ID to resume from")
    scene_number: int = Field(..., description="Scene number being resumed")
    duration: int = Field(default=5, description="Animation duration (5 or 10 seconds)")
