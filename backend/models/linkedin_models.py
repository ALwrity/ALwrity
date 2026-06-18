"""
LinkedIn Content Generation Models for ALwrity

This module defines the data models for LinkedIn content generation endpoints.
Enhanced to support grounding capabilities with source integration and quality metrics.
"""

from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any, Literal
from datetime import datetime
from enum import Enum


class LinkedInPostType(str, Enum):
    """Types of LinkedIn posts."""
    PROFESSIONAL = "professional"
    THOUGHT_LEADERSHIP = "thought_leadership"
    INDUSTRY_NEWS = "industry_news"
    PERSONAL_STORY = "personal_story"
    COMPANY_UPDATE = "company_update"
    POLL = "poll"


class LinkedInTone(str, Enum):
    """LinkedIn content tone options."""
    PROFESSIONAL = "professional"
    CONVERSATIONAL = "conversational"
    AUTHORITATIVE = "authoritative"
    INSPIRATIONAL = "inspirational"
    EDUCATIONAL = "educational"
    FRIENDLY = "friendly"


class SearchEngine(str, Enum):
    """Available search engines for research."""
    METAPHOR = "metaphor"
    GOOGLE = "google"
    TAVILY = "tavily"
    EXA = "exa"


class GroundingLevel(str, Enum):
    """Levels of content grounding."""
    NONE = "none"
    BASIC = "basic"
    ENHANCED = "enhanced"
    ENTERPRISE = "enterprise"


class LinkedInPostRequest(BaseModel):
    """Request model for LinkedIn post generation."""
    topic: str = Field(..., description="Main topic for the post", min_length=3, max_length=200)
    industry: str = Field(..., description="Target industry context", min_length=2, max_length=100)
    post_type: LinkedInPostType = Field(default=LinkedInPostType.PROFESSIONAL, description="Type of LinkedIn post")
    tone: LinkedInTone = Field(default=LinkedInTone.PROFESSIONAL, description="Tone of the post")
    target_audience: Optional[str] = Field(None, description="Specific target audience", max_length=200)
    key_points: Optional[List[str]] = Field(None, description="Key points to include", max_items=10)
    include_hashtags: bool = Field(default=True, description="Whether to include hashtags")
    include_call_to_action: bool = Field(default=True, description="Whether to include call to action")
    research_enabled: bool = Field(default=True, description="Whether to include research-backed content")
    search_engine: SearchEngine = Field(default=SearchEngine.EXA, description="Search engine for research")
    max_length: int = Field(default=3000, description="Maximum character count", ge=100, le=3000)
    grounding_level: GroundingLevel = Field(default=GroundingLevel.ENHANCED, description="Level of content grounding")
    include_citations: bool = Field(default=True, description="Whether to include inline citations")
    user_id: Optional[int] = Field(default=1, description="User id for persona lookup")
    persona_override: Optional[Dict[str, Any]] = Field(default=None, description="Session-only persona overrides to apply without saving")
    
    class Config:
        json_schema_extra = {
            "example": {
                "topic": "AI in healthcare transformation",
                "industry": "Healthcare",
                "post_type": "thought_leadership",
                "tone": "professional",
                "target_audience": "Healthcare executives and professionals",
                "key_points": ["AI diagnostics", "Patient outcomes", "Cost reduction"],
                "include_hashtags": True,
                "include_call_to_action": True,
                "research_enabled": True,
                "search_engine": "google",
                "max_length": 2000,
                "grounding_level": "enhanced",
                "include_citations": True
            }
        }


class LinkedInArticleRequest(BaseModel):
    """Request model for LinkedIn article generation."""
    topic: str = Field(..., description="Main topic for the article", min_length=3, max_length=200)
    industry: str = Field(..., description="Target industry context", min_length=2, max_length=100)
    tone: LinkedInTone = Field(default=LinkedInTone.PROFESSIONAL, description="Tone of the article")
    target_audience: Optional[str] = Field(None, description="Specific target audience", max_length=200)
    key_sections: Optional[List[str]] = Field(None, description="Key sections to include", max_items=10)
    include_images: bool = Field(default=True, description="Whether to generate image suggestions")
    seo_optimization: bool = Field(default=True, description="Whether to include SEO optimization")
    research_enabled: bool = Field(default=True, description="Whether to include research-backed content")
    search_engine: SearchEngine = Field(default=SearchEngine.EXA, description="Search engine for research")
    word_count: int = Field(default=1500, description="Target word count", ge=500, le=5000)
    grounding_level: GroundingLevel = Field(default=GroundingLevel.ENHANCED, description="Level of content grounding")
    include_citations: bool = Field(default=True, description="Whether to include inline citations")
    user_id: Optional[int] = Field(default=1, description="User id for persona lookup")
    persona_override: Optional[Dict[str, Any]] = Field(default=None, description="Session-only persona overrides to apply without saving")
    
    class Config:
        json_schema_extra = {
            "example": {
                "topic": "Digital transformation in manufacturing",
                "industry": "Manufacturing",
                "tone": "professional",
                "target_audience": "Manufacturing leaders and technology professionals",
                "key_sections": ["Current challenges", "Technology solutions", "Implementation strategies"],
                "include_images": True,
                "seo_optimization": True,
                "research_enabled": True,
                "search_engine": "google",
                "word_count": 2000,
                "grounding_level": "enhanced",
                "include_citations": True
            }
        }


class LinkedInCarouselRequest(BaseModel):
    """Request model for LinkedIn carousel generation."""
    topic: str = Field(..., description="Main topic for the carousel", min_length=3, max_length=200)
    industry: str = Field(..., description="Target industry context", min_length=2, max_length=100)
    tone: LinkedInTone = Field(default=LinkedInTone.PROFESSIONAL, description="Tone of the carousel")
    target_audience: Optional[str] = Field(None, description="Specific target audience", max_length=200)
    number_of_slides: int = Field(default=5, description="Number of slides", ge=3, le=10)
    include_cover_slide: bool = Field(default=True, description="Whether to include a cover slide")
    include_cta_slide: bool = Field(default=True, description="Whether to include a call-to-action slide")
    key_points: Optional[List[str]] = Field(None, description="Specific key points to cover", max_items=10)
    research_enabled: bool = Field(default=True, description="Whether to include research-backed content")
    search_engine: SearchEngine = Field(default=SearchEngine.EXA, description="Search engine for research")
    grounding_level: GroundingLevel = Field(default=GroundingLevel.ENHANCED, description="Level of content grounding")
    color_scheme: str = Field(default="professional", description="Color scheme for PDF rendering: professional, creative, industry, dark, minimal")
    include_citations: bool = Field(default=True, description="Whether to include inline citations")
    
    class Config:
        json_schema_extra = {
            "example": {
                "topic": "Future of remote work",
                "industry": "Technology",
                "tone": "professional",
                "target_audience": "HR professionals and business leaders",
                "number_of_slides": 6,
                "include_cover_slide": True,
                "include_cta_slide": True,
                "key_points": ["Remote collaboration tools", "Work-life balance", "Productivity metrics"],
                "research_enabled": True,
                "search_engine": "google",
                "grounding_level": "enhanced",
                "color_scheme": "professional",
                "include_citations": True
            }
        }


class LinkedInVideoScriptRequest(BaseModel):
    """Request model for LinkedIn video script generation."""
    topic: str = Field(..., description="Main topic for the video script", min_length=3, max_length=200)
    industry: str = Field(..., description="Target industry context", min_length=2, max_length=100)
    tone: LinkedInTone = Field(default=LinkedInTone.PROFESSIONAL, description="Tone of the video script")
    target_audience: Optional[str] = Field(None, description="Specific target audience", max_length=200)
    video_duration: int = Field(default=60, description="Target video duration in seconds", ge=30, le=300)
    include_captions: bool = Field(default=True, description="Whether to include captions")
    include_thumbnail_suggestions: bool = Field(default=True, description="Whether to include thumbnail suggestions")
    key_points: Optional[List[str]] = Field(None, description="Specific key points to cover in the video", max_items=10)
    research_enabled: bool = Field(default=True, description="Whether to include research-backed content")
    search_engine: SearchEngine = Field(default=SearchEngine.EXA, description="Search engine for research")
    grounding_level: GroundingLevel = Field(default=GroundingLevel.ENHANCED, description="Level of content grounding")
    include_citations: bool = Field(default=True, description="Whether to include inline citations")
    
    class Config:
        json_schema_extra = {
            "example": {
                "topic": "Cybersecurity best practices",
                "industry": "Technology",
                "tone": "educational",
                "target_audience": "IT professionals and business leaders",
                "video_duration": 90,
                "include_captions": True,
                "include_thumbnail_suggestions": True,
                "key_points": ["Zero trust architecture", "Phishing prevention", "Incident response"],
                "research_enabled": True,
                "search_engine": "google",
                "grounding_level": "enhanced",
                "include_citations": True
            }
        }


class LinkedInCommentResponseRequest(BaseModel):
    """Request model for LinkedIn comment response generation."""
    original_comment: str = Field(..., description="Original comment to respond to", min_length=10, max_length=1000)
    post_context: str = Field(..., description="Context of the post being commented on", min_length=10, max_length=500)
    industry: str = Field(..., description="Industry context", min_length=2, max_length=100)
    tone: LinkedInTone = Field(default=LinkedInTone.FRIENDLY, description="Tone of the response")
    response_length: str = Field(default="medium", description="Length of response: short, medium, long")
    include_questions: bool = Field(default=True, description="Whether to include engaging questions")
    research_enabled: bool = Field(default=False, description="Whether to include research-backed content")
    search_engine: SearchEngine = Field(default=SearchEngine.EXA, description="Search engine for research")
    grounding_level: GroundingLevel = Field(default=GroundingLevel.BASIC, description="Level of content grounding")
    
    class Config:
        json_schema_extra = {
            "example": {
                "original_comment": "Great insights on AI implementation!",
                "post_context": "Post about AI transformation in healthcare",
                "industry": "Healthcare",
                "tone": "friendly",
                "response_length": "medium",
                "include_questions": True,
                "research_enabled": False,
                "search_engine": "google",
                "grounding_level": "basic"
            }
        }


# Enhanced Research Source Model
class ResearchSource(BaseModel):
    """Enhanced model for research source information with grounding capabilities."""
    title: str
    url: str
    content: str
    relevance_score: Optional[float] = Field(None, description="Relevance score (0.0-1.0)")
    credibility_score: Optional[float] = Field(None, description="Credibility score (0.0-1.0)")
    domain_authority: Optional[float] = Field(None, description="Domain authority score (0.0-1.0)")
    source_type: Optional[str] = Field(None, description="Type of source (academic, business_news, etc.)")
    publication_date: Optional[str] = Field(None, description="Publication date if available")
    raw_result: Optional[Dict[str, Any]] = Field(None, description="Raw search result data")


# Enhanced Hashtag Suggestion Model
class HashtagSuggestion(BaseModel):
    """Enhanced model for hashtag suggestions."""
    hashtag: str
    category: str
    popularity_score: Optional[float] = Field(None, description="Popularity score (0.0-1.0)")
    relevance_score: Optional[float] = Field(None, description="Relevance to topic (0.0-1.0)")
    industry_alignment: Optional[float] = Field(None, description="Industry alignment score (0.0-1.0)")


# Enhanced Image Suggestion Model
class ImageSuggestion(BaseModel):
    """Enhanced model for image suggestions."""
    description: str
    alt_text: str
    style: Optional[str] = Field(None, description="Visual style description")
    placement: Optional[str] = Field(None, description="Suggested placement in content")
    relevance_score: Optional[float] = Field(None, description="Relevance to content (0.0-1.0)")


# New Quality Metrics Model
class ContentQualityMetrics(BaseModel):
    """Model for content quality assessment metrics."""
    overall_score: float = Field(..., description="Overall quality score (0.0-1.0)")
    factual_accuracy: float = Field(..., description="Factual accuracy score (0.0-1.0)")
    source_verification: float = Field(..., description="Source verification score (0.0-1.0)")
    professional_tone: float = Field(..., description="Professional tone score (0.0-1.0)")
    industry_relevance: float = Field(..., description="Industry relevance score (0.0-1.0)")
    citation_coverage: float = Field(..., description="Citation coverage score (0.0-1.0)")
    content_length: int = Field(..., description="Content length in characters")
    word_count: int = Field(..., description="Word count")
    analysis_timestamp: str = Field(..., description="Timestamp of quality analysis")
    recommendations: Optional[List[str]] = Field(default_factory=list, description="List of improvement recommendations")


# New Citation Model
class Citation(BaseModel):
    """Model for inline citations in content."""
    type: str = Field(..., description="Type of citation (inline, footnote, etc.)")
    reference: str = Field(..., description="Citation reference (e.g., 'Source 1')")
    position: Optional[int] = Field(None, description="Position in content")
    source_index: Optional[int] = Field(None, description="Index of source in research_sources")


# Enhanced Post Content Model
class PostContent(BaseModel):
    """Enhanced model for generated post content with grounding capabilities."""
    content: str
    character_count: int
    hashtags: List[HashtagSuggestion]
    call_to_action: Optional[str] = None
    engagement_prediction: Optional[Dict[str, Any]] = None
    citations: List[Citation] = Field(default_factory=list, description="Inline citations")
    source_list: Optional[str] = Field(None, description="Formatted source list")
    quality_metrics: Optional[ContentQualityMetrics] = Field(None, description="Content quality metrics")
    grounding_enabled: bool = Field(default=False, description="Whether grounding was used")
    search_queries: Optional[List[str]] = Field(default_factory=list, description="Search queries used for research")


# Enhanced Article Content Model
class ArticleContent(BaseModel):
    """Enhanced model for generated article content with grounding capabilities."""
    title: str
    content: str
    word_count: int
    sections: List[Dict[str, str]]
    seo_metadata: Optional[Dict[str, Any]] = None
    image_suggestions: List[ImageSuggestion]
    reading_time: Optional[int] = None
    citations: List[Citation] = Field(default_factory=list, description="Inline citations")
    source_list: Optional[str] = Field(None, description="Formatted source list")
    quality_metrics: Optional[ContentQualityMetrics] = Field(None, description="Content quality metrics")
    grounding_enabled: bool = Field(default=False, description="Whether grounding was used")
    search_queries: Optional[List[str]] = Field(default_factory=list, description="Search queries used for research")


# Enhanced Carousel Slide Model
class CarouselSlide(BaseModel):
    """Enhanced model for carousel slide content."""
    slide_number: int
    title: str
    content: str
    visual_elements: List[str]
    design_notes: Optional[str] = None
    citations: List[Citation] = Field(default_factory=list, description="Inline citations for this slide")


# Enhanced Carousel Content Model
class CarouselContent(BaseModel):
    """Enhanced model for generated carousel content with grounding capabilities."""
    title: str
    slides: List[CarouselSlide]
    cover_slide: Optional[CarouselSlide] = None
    cta_slide: Optional[CarouselSlide] = None
    design_guidelines: Dict[str, str]
    citations: List[Citation] = Field(default_factory=list, description="Overall citations")
    source_list: Optional[str] = Field(None, description="Formatted source list")
    quality_metrics: Optional[ContentQualityMetrics] = Field(None, description="Content quality metrics")
    grounding_enabled: bool = Field(default=False, description="Whether grounding was used")


# Enhanced Video Script Model
class VideoScript(BaseModel):
    """Enhanced model for video script content with grounding capabilities."""
    hook: str
    main_content: List[Dict[str, str]]  # scene_number, content, duration, visual_notes
    conclusion: str
    captions: Optional[List[str]] = None
    thumbnail_suggestions: List[str]
    video_description: str
    citations: List[Citation] = Field(default_factory=list, description="Inline citations")
    source_list: Optional[str] = Field(None, description="Formatted source list")
    quality_metrics: Optional[ContentQualityMetrics] = Field(None, description="Content quality metrics")
    grounding_enabled: bool = Field(default=False, description="Whether grounding was used")


# Enhanced LinkedIn Post Response Model
class LinkedInPostResponse(BaseModel):
    """Enhanced response model for LinkedIn post generation with grounding capabilities."""
    success: bool = True
    data: Optional[PostContent] = None
    research_sources: List[ResearchSource] = []
    generation_metadata: Dict[str, Any] = {}
    error: Optional[str] = None
    grounding_status: Optional[Dict[str, Any]] = Field(None, description="Grounding operation status")
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "data": {
                    "content": "🚀 AI is revolutionizing healthcare...",
                    "character_count": 1250,
                    "hashtags": [
                        {"hashtag": "#AIinHealthcare", "category": "industry", "popularity_score": 0.9},
                        {"hashtag": "#DigitalTransformation", "category": "general", "popularity_score": 0.8}
                    ],
                    "call_to_action": "What's your experience with AI in healthcare? Share in the comments!",
                    "engagement_prediction": {"estimated_likes": 120, "estimated_comments": 15},
                    "citations": [
                        {"type": "inline", "reference": "Source 1", "position": 45}
                    ],
                    "source_list": "**Sources:**\n1. **AI in Healthcare: Current Trends**\n   - URL: [https://example.com/ai-healthcare](https://example.com/ai-healthcare)",
                    "quality_metrics": {
                        "overall_score": 0.85,
                        "factual_accuracy": 0.9,
                        "source_verification": 0.8,
                        "professional_tone": 0.9,
                        "industry_relevance": 0.85,
                        "citation_coverage": 0.8,
                        "content_length": 1250,
                        "word_count": 180,
                        "analysis_timestamp": "2025-01-15T10:30:00Z"
                    },
                    "grounding_enabled": True
                },
                "research_sources": [
                    {
                        "title": "AI in Healthcare: Current Trends",
                        "url": "https://example.com/ai-healthcare",
                        "content": "Summary of AI healthcare trends...",
                        "relevance_score": 0.95,
                        "credibility_score": 0.85,
                        "domain_authority": 0.9,
                        "source_type": "business_news"
                    }
                ],
                "generation_metadata": {
                    "model_used": "gemini-2.0-flash-001",
                    "generation_time": 3.2,
                    "research_time": 5.1,
                    "grounding_enabled": True
                },
                "grounding_status": {
                    "status": "success",
                    "sources_used": 3,
                    "citation_coverage": 0.8,
                    "quality_score": 0.85
                }
            }
        }


# Enhanced LinkedIn Article Response Model
class LinkedInArticleResponse(BaseModel):
    """Enhanced response model for LinkedIn article generation with grounding capabilities."""
    success: bool = True
    data: Optional[ArticleContent] = None
    research_sources: List[ResearchSource] = []
    generation_metadata: Dict[str, Any] = {}
    error: Optional[str] = None
    grounding_status: Optional[Dict[str, Any]] = Field(None, description="Grounding operation status")


# Enhanced LinkedIn Carousel Response Model
class LinkedInCarouselResponse(BaseModel):
    """Enhanced response model for LinkedIn carousel generation with grounding capabilities."""
    success: bool = True
    data: Optional[CarouselContent] = None
    research_sources: List[ResearchSource] = []
    generation_metadata: Dict[str, Any] = {}
    error: Optional[str] = None
    grounding_status: Optional[Dict[str, Any]] = Field(None, description="Grounding operation status")


# Enhanced LinkedIn Video Script Response Model
class LinkedInVideoScriptResponse(BaseModel):
    """Enhanced response model for LinkedIn video script generation with grounding capabilities."""
    success: bool = True
    data: Optional[VideoScript] = None
    research_sources: List[ResearchSource] = []
    generation_metadata: Dict[str, Any] = {}
    error: Optional[str] = None
    grounding_status: Optional[Dict[str, Any]] = Field(None, description="Grounding operation status")


# Enhanced LinkedIn Comment Response Result Model
class LinkedInCommentResponseResult(BaseModel):
    """Enhanced response model for LinkedIn comment response generation with grounding capabilities."""
    success: bool = True
    response: Optional[str] = None
    alternative_responses: List[str] = []
    tone_analysis: Optional[Dict[str, Any]] = None
    generation_metadata: Dict[str, Any] = {}
    error: Optional[str] = None
    grounding_status: Optional[Dict[str, Any]] = Field(None, description="Grounding operation status")


class LinkedInEditContentRequest(BaseModel):
    """Request model for AI-powered LinkedIn content editing."""
    content: str = Field(..., description="Content to edit", min_length=1)
    edit_type: str = Field(..., description="Type of edit: professionalize, optimize_engagement, add_hashtags, adjust_tone, expand, condense, add_cta")
    industry: Optional[str] = Field(None, description="Industry context for the edit")
    tone: Optional[str] = Field(None, description="Target tone: professional, conversational, authoritative, educational, friendly")
    target_audience: Optional[str] = Field(None, description="Target audience for the content")
    parameters: Optional[Dict[str, Any]] = Field(None, description="Additional parameters specific to edit type")


class LinkedInEditContentResponse(BaseModel):
    """Response model for AI-powered LinkedIn content editing."""
    success: bool = True
    content: Optional[str] = None
    edit_type: str
    provider: Optional[str] = None
    model: Optional[str] = None
    error: Optional[str] = None


class LinkedInAudioNarrationRequest(BaseModel):
    """Request model for LinkedIn narration audio generation."""

    text: Optional[str] = Field(
        None,
        description="Raw narration text (alternative to video_script)",
        min_length=10,
        max_length=10000,
    )
    video_script: Optional[VideoScript] = Field(
        None,
        description="LinkedIn video script to convert into narration",
    )
    target_duration_seconds: int = Field(
        default=75,
        description="Target spoken duration in seconds (LinkedIn clips: 30–90s)",
        ge=30,
        le=90,
    )
    voice_id: str = Field(default="Wise_Woman", description="TTS voice ID")
    custom_voice_id: Optional[str] = Field(None, description="Custom cloned voice ID")
    speed: float = Field(default=1.0, ge=0.5, le=2.0, description="Speech speed multiplier")
    volume: float = Field(default=1.0, ge=0.1, le=10.0, description="Speech volume")
    pitch: float = Field(default=0.0, ge=-12.0, le=12.0, description="Speech pitch")
    emotion: Optional[str] = Field(
        None,
        description="TTS emotion override (defaults from tone when omitted)",
    )
    tone: Optional[LinkedInTone] = Field(
        default=LinkedInTone.PROFESSIONAL,
        description="LinkedIn tone used to pick a professional TTS emotion",
    )
    topic: Optional[str] = Field(None, description="Topic label for metadata", max_length=200)
    industry: Optional[str] = Field(None, description="Industry label for metadata", max_length=100)

    @validator("video_script", always=True)
    def require_text_or_video_script(cls, video_script, values):
        text = values.get("text")
        if not text and not video_script:
            raise ValueError("Either text or video_script must be provided")
        return video_script

    class Config:
        json_schema_extra = {
            "example": {
                "video_script": {
                    "hook": "Did you know 70% of B2B buyers research on LinkedIn before reaching out?",
                    "main_content": [
                        {
                            "scene_number": "1",
                            "content": "Start by optimizing your profile headline for your ideal client.",
                            "duration": "20",
                            "visual_notes": "Profile screenshot",
                        }
                    ],
                    "conclusion": "Follow for more LinkedIn growth tips.",
                    "thumbnail_suggestions": ["Profile optimization checklist"],
                    "video_description": "LinkedIn profile tips for B2B sellers",
                },
                "target_duration_seconds": 75,
                "tone": "professional",
                "topic": "LinkedIn profile optimization",
                "industry": "Marketing",
            }
        }


class LinkedInAudioMetadata(BaseModel):
    """Metadata returned after LinkedIn narration generation."""

    provider: str
    model: str
    voice_id: str
    text_length: int
    file_size: int
    estimated_duration_seconds: float
    target_duration_seconds: int
    generation_time: float
    format: str = "mp3"
    topic: Optional[str] = None
    industry: Optional[str] = None


class LinkedInAudioNarrationResponse(BaseModel):
    """Response model for LinkedIn narration audio generation."""

    success: bool = True
    audio_id: Optional[str] = None
    download_path: Optional[str] = None
    metadata: Optional[LinkedInAudioMetadata] = None
    error: Optional[str] = None