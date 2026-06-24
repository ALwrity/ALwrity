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


# Structured output schema for LLM post generation
class LinkedInPostOutput(BaseModel):
    """Structured JSON schema enforced on the LLM for grounded LinkedIn post generation."""
    content: str = Field(..., description="The full post text with [Source N] markers immediately after claims backed by research")
    hashtags: List[str] = Field(default_factory=list, description="3-5 relevant LinkedIn hashtags extracted from the content")
    call_to_action: Optional[str] = Field(None, description="The call-to-action sentence from the post, if present")
    cited_source_indices: List[int] = Field(default_factory=list, description="1-based indices into the research sources array for every [Source N] marker used in content")

    class Config:
        json_schema_extra = {
            "example": {
                "content": "AI adoption surged 40% in enterprises this year [Source 1]. Leaders who invest now gain a competitive edge [Source 2].\n\nWhat's your take? #AI #TechTrends",
                "hashtags": ["#AI", "#DigitalTransformation", "#TechTrends"],
                "call_to_action": "What's your take on AI adoption in your industry? Share below!",
                "cited_source_indices": [1, 2]
            }
        }


# Structured output schema for LLM article generation
class LinkedInArticleOutput(BaseModel):
    """Structured JSON schema enforced on the LLM for grounded LinkedIn article generation."""
    title: str = Field(..., description="Compelling article headline with [Source N] markers where backed by research")
    content: str = Field(..., description="Full article body with [Source N] markers immediately after claims backed by research")
    sections: List[Dict[str, str]] = Field(default_factory=list, description="List of sections each with heading and body")
    seo_metadata: Optional[Dict[str, Any]] = Field(None, description="SEO keywords and meta description")
    reading_time: Optional[int] = Field(None, description="Estimated reading time in minutes")
    cited_source_indices: List[int] = Field(default_factory=list, description="1-based indices into the research sources array for every [Source N] marker used in content")

    class Config:
        json_schema_extra = {
            "example": {
                "title": "The Future of AI in Enterprise: Key Trends for 2026",
                "content": "Artificial intelligence continues to reshape enterprise operations [Source 1]...",
                "sections": [{"heading": "Current Landscape", "body": "Enterprises are adopting AI at an unprecedented rate..."}],
                "seo_metadata": {"keywords": ["AI", "enterprise", "digital transformation"]},
                "reading_time": 5,
                "cited_source_indices": [1, 3]
            }
        }


# Structured output schema for LLM carousel generation
class CarouselSlideOutput(BaseModel):
    """A single slide within a LinkedIn carousel."""
    slide_number: int = Field(..., description="Slide position (1-based)")
    title: str = Field(..., description="Slide headline")
    content: str = Field(..., description="Slide body text with [Source N] markers where backed by research")
    visual_elements: List[str] = Field(default_factory=list, description="Suggested visual elements for this slide")
    design_notes: Optional[str] = Field(None, description="Design guidance for this slide")


class LinkedInCarouselOutput(BaseModel):
    """Structured JSON schema enforced on the LLM for grounded LinkedIn carousel generation."""
    title: str = Field(..., description="Carousel overarching title")
    slides: List[CarouselSlideOutput] = Field(..., description="All content slides")
    cover_slide: Optional[CarouselSlideOutput] = Field(None, description="Optional cover/intro slide")
    cta_slide: Optional[CarouselSlideOutput] = Field(None, description="Optional call-to-action closing slide")
    design_guidelines: Dict[str, str] = Field(default_factory=dict, description="Visual design guidance")
    cited_source_indices: List[int] = Field(default_factory=list, description="1-based indices into the research sources array for every [Source N] marker used in any slide")

    class Config:
        json_schema_extra = {
            "example": {
                "title": "5 AI Trends Transforming Enterprise",
                "slides": [
                    {"slide_number": 1, "title": "AI Adoption Surge", "content": "Enterprise AI adoption grew 40% in 2025 [Source 1]", "visual_elements": ["bar chart"], "design_notes": "Use blue gradient"}
                ],
                "cited_source_indices": [1]
            }
        }


class SceneOutput(BaseModel):
    """A single scene within a video script."""
    scene_number: int = Field(..., description="Scene order (1-based)")
    content: str = Field(..., description="Scene narration/script text with [Source N] markers where backed by research")
    duration: Optional[str] = Field(None, description="Estimated duration of this scene")
    visual_notes: Optional[str] = Field(None, description="Visual guidance for this scene")


# Structured output schema for LLM video script generation
class LinkedInVideoScriptOutput(BaseModel):
    """Structured JSON schema enforced on the LLM for grounded LinkedIn video script generation."""
    hook: str = Field(..., description="Opening hook (first 3 seconds) with [Source N] markers where backed by research")
    main_content: List[SceneOutput] = Field(..., description="Main content scenes")
    conclusion: str = Field(..., description="Closing remarks and call-to-action")
    captions: Optional[List[str]] = Field(None, description="Optimized caption text for each scene")
    thumbnail_suggestions: List[str] = Field(default_factory=list, description="Suggested thumbnail ideas")
    video_description: str = Field(..., description="Post/video description with hashtags")
    cited_source_indices: List[int] = Field(default_factory=list, description="1-based indices into the research sources array for every [Source N] marker used in any scene")

    class Config:
        json_schema_extra = {
            "example": {
                "hook": "Did you know AI adoption in enterprises surged 40% last year? [Source 1]",
                "main_content": [
                    {"scene_number": 1, "content": "Let's break down what this means for your business...", "duration": "15s", "visual_notes": "Talking head with data overlay"}
                ],
                "conclusion": "Follow for more AI insights!",
                "thumbnail_suggestions": ["AI stats overlay on speaker"],
                "video_description": "AI is transforming enterprise. #AI #TechTrends",
                "cited_source_indices": [1]
            }
        }


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