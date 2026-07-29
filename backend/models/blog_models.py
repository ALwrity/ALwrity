from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional, Union
from enum import Enum


class PersonaInfo(BaseModel):
    persona_id: Optional[str] = None
    tone: Optional[str] = None
    audience: Optional[str] = None
    industry: Optional[str] = None


class ResearchSource(BaseModel):
    title: str
    url: str
    excerpt: Optional[str] = None
    credibility_score: Optional[float] = None
    published_at: Optional[str] = None
    index: Optional[int] = None
    source_type: Optional[str] = None  # e.g., 'web'
    highlights: Optional[List[str]] = None  # Exa key highlights up to 3 per URL
    summary: Optional[str] = None  # Exa AI-generated summary
    image: Optional[str] = None  # Source thumbnail image URL
    author: Optional[str] = None  # Content author
    content: Optional[str] = None  # Full extracted text


class GroundingChunk(BaseModel):
    title: str
    url: str
    confidence_score: Optional[float] = None


class GroundingSupport(BaseModel):
    confidence_scores: List[float] = []
    grounding_chunk_indices: List[int] = []
    segment_text: str = ""
    start_index: Optional[int] = None
    end_index: Optional[int] = None


class Citation(BaseModel):
    citation_type: str  # e.g., 'inline'
    start_index: int
    end_index: int
    text: str
    source_indices: List[int] = []
    reference: str  # e.g., 'Source 1'


class GroundingMetadata(BaseModel):
    grounding_chunks: List[GroundingChunk] = []
    grounding_supports: List[GroundingSupport] = []
    citations: List[Citation] = []
    search_entry_point: Optional[str] = None
    web_search_queries: List[str] = []


class ResearchMode(str, Enum):
    """Research modes for different depth levels."""
    BASIC = "basic"
    COMPREHENSIVE = "comprehensive"
    TARGETED = "targeted"


class SourceType(str, Enum):
    """Types of sources to include in research."""
    WEB = "web"
    ACADEMIC = "academic"
    NEWS = "news"
    INDUSTRY = "industry"
    EXPERT = "expert"


class DateRange(str, Enum):
    """Date range filters for research."""
    LAST_WEEK = "last_week"
    LAST_MONTH = "last_month"
    LAST_3_MONTHS = "last_3_months"
    LAST_6_MONTHS = "last_6_months"
    LAST_YEAR = "last_year"
    ALL_TIME = "all_time"


class ResearchProvider(str, Enum):
    """Research provider options."""
    GOOGLE = "google"  # Gemini native grounding
    EXA = "exa"        # Exa neural search
    TAVILY = "tavily"  # Tavily AI-powered search


class ResearchConfig(BaseModel):
    """Configuration for research execution."""
    mode: ResearchMode = ResearchMode.BASIC
    provider: ResearchProvider = ResearchProvider.GOOGLE
    date_range: Optional[DateRange] = None
    source_types: List[SourceType] = []
    max_sources: int = 10
    include_statistics: bool = True
    include_expert_quotes: bool = True
    include_competitors: bool = True
    include_trends: bool = True
    
    # Exa-specific options
    exa_category: Optional[str] = None  # company, research paper, news, linkedin profile, github, tweet, movie, song, personal site, pdf, financial report
    exa_include_domains: List[str] = []  # Domain whitelist
    exa_exclude_domains: List[str] = []  # Domain blacklist
    exa_search_type: Optional[str] = "auto"  # "auto", "keyword", "neural", "fast", "deep"
    exa_additional_queries: Optional[List[str]] = None  # Additional query variations for Deep search (only works with type="deep")
    
    # Tavily-specific options
    tavily_topic: Optional[str] = "general"  # general, news, finance
    tavily_search_depth: Optional[str] = "basic"  # basic (1 credit), advanced (2 credits)
    tavily_include_domains: List[str] = []  # Domain whitelist (max 300)
    tavily_exclude_domains: List[str] = []  # Domain blacklist (max 150)
    tavily_include_answer: Union[bool, str] = False  # basic, advanced, true, false
    tavily_include_raw_content: Union[bool, str] = False  # markdown, text, true, false
    tavily_include_images: bool = False
    tavily_include_image_descriptions: bool = False
    tavily_include_favicon: bool = False
    tavily_time_range: Optional[str] = None  # day, week, month, year, d, w, m, y
    tavily_start_date: Optional[str] = None  # YYYY-MM-DD
    tavily_end_date: Optional[str] = None  # YYYY-MM-DD
    tavily_country: Optional[str] = None  # Country code (only for general topic)
    tavily_chunks_per_source: int = 3  # 1-3 (only for advanced search)
    tavily_auto_parameters: bool = False  # Auto-configure parameters based on query


class BlogResearchRequest(BaseModel):
    keywords: List[str]
    topic: Optional[str] = None
    industry: Optional[str] = None
    target_audience: Optional[str] = None
    tone: Optional[str] = None
    word_count_target: Optional[int] = 1500
    persona: Optional[PersonaInfo] = None
    research_mode: Optional[ResearchMode] = ResearchMode.BASIC
    config: Optional[ResearchConfig] = None


class BlogResearchResponse(BaseModel):
    success: bool = True
    sources: List[ResearchSource] = []
    keyword_analysis: Dict[str, Any] = {}
    competitor_analysis: Dict[str, Any] = {}
    suggested_angles: List[str] = []
    search_widget: Optional[str] = None  # HTML content for search widget
    search_queries: List[str] = []  # Search queries generated by Gemini
    grounding_metadata: Optional[GroundingMetadata] = None  # Google grounding metadata
    original_keywords: List[str] = []  # Original user-provided keywords for caching
    error_message: Optional[str] = None  # Error message for graceful failures
    retry_suggested: Optional[bool] = None  # Whether retry is recommended
    error_code: Optional[str] = None  # Specific error code
    actionable_steps: List[str] = []  # Steps user can take to resolve the issue


class BlogOutlineSection(BaseModel):
    id: str
    heading: str
    subheadings: List[str] = []
    key_points: List[str] = []
    references: List[ResearchSource] = []
    target_words: Optional[int] = None
    keywords: List[str] = []
    chart_data: Optional[Dict[str, Any]] = None
    chart_url: Optional[str] = None
    chart_id: Optional[str] = None


class BlogOutlineRequest(BaseModel):
    research: BlogResearchResponse
    persona: Optional[PersonaInfo] = None
    word_count: Optional[int] = 1500
    custom_instructions: Optional[str] = None
    selected_content_angle: Optional[str] = None  # Prioritized content angle for outline generation
    selected_competitive_advantage: Optional[str] = None  # Prioritized competitive advantage to emphasize in outline


class SourceMappingStats(BaseModel):
    total_sources_mapped: int = 0
    coverage_percentage: float = 0.0
    average_relevance_score: float = 0.0
    high_confidence_mappings: int = 0

class GroundingInsights(BaseModel):
    confidence_analysis: Optional[Dict[str, Any]] = None
    authority_analysis: Optional[Dict[str, Any]] = None
    temporal_analysis: Optional[Dict[str, Any]] = None
    content_relationships: Optional[Dict[str, Any]] = None
    citation_insights: Optional[Dict[str, Any]] = None
    search_intent_insights: Optional[Dict[str, Any]] = None
    quality_indicators: Optional[Dict[str, Any]] = None

class ResearchCoverage(BaseModel):
    sources_utilized: int = 0
    content_gaps_identified: int = 0
    competitive_advantages: List[str] = []

class BlogOutlineResponse(BaseModel):
    success: bool = True
    title_options: List[str] = []
    outline: List[BlogOutlineSection] = []
    
    # Additional metadata for enhanced UI
    source_mapping_stats: Optional[SourceMappingStats] = None
    grounding_insights: Optional[GroundingInsights] = None
    research_coverage: Optional[ResearchCoverage] = None


class BlogOutlineRefineRequest(BaseModel):
    outline: List[BlogOutlineSection]
    operation: str
    section_id: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None


class BlogSectionRequest(BaseModel):
    section: BlogOutlineSection
    keywords: List[str] = []
    tone: Optional[str] = None
    persona: Optional[PersonaInfo] = None
    mode: Optional[str] = "polished"  # 'draft' | 'polished'
    research: Optional[BlogResearchResponse] = None
    competitive_advantage: Optional[str] = None


class BlogSectionResponse(BaseModel):
    success: bool = True
    markdown: str
    citations: List[ResearchSource] = []
    continuity_metrics: Optional[Dict[str, float]] = None


class BlogOptimizeRequest(BaseModel):
    content: str
    goals: List[str] = []


class BlogOptimizeResponse(BaseModel):
    success: bool = True
    optimized: str
    diff_preview: Optional[str] = None
    error: Optional[str] = None


class BlogSEOAnalyzeRequest(BaseModel):
    content: str
    blog_title: Optional[str] = None
    keywords: List[str] = []
    research_data: Optional[Dict[str, Any]] = None


class BlogSEOAnalyzeResponse(BaseModel):
    success: bool = True
    seo_score: float
    density: Dict[str, Any] = {}
    structure: Dict[str, Any] = {}
    readability: Dict[str, Any] = {}
    link_suggestions: List[Dict[str, Any]] = []
    image_alt_status: Dict[str, Any] = {}
    recommendations: List[str] = []


class BlogSEOMetadataRequest(BaseModel):
    content: str
    title: Optional[str] = None
    keywords: List[str] = []
    research_data: Optional[Dict[str, Any]] = None
    outline: Optional[List[Dict[str, Any]]] = None  # Add outline structure
    seo_analysis: Optional[Dict[str, Any]] = None  # Add SEO analysis results


class BlogSEOMetadataResponse(BaseModel):
    success: bool = True
    title_options: List[str] = []
    meta_descriptions: List[str] = []
    seo_title: Optional[str] = None
    meta_description: Optional[str] = None
    url_slug: Optional[str] = None
    blog_tags: List[str] = []
    blog_categories: List[str] = []
    social_hashtags: List[str] = []
    open_graph: Dict[str, Any] = {}
    twitter_card: Dict[str, Any] = {}
    json_ld_schema: Dict[str, Any] = {}
    canonical_url: Optional[str] = None
    reading_time: float = 0.0
    focus_keyword: Optional[str] = None
    generated_at: Optional[str] = None
    optimization_score: int = 0
    error: Optional[str] = None


class BlogPublishRequest(BaseModel):
    platform: str = Field(pattern="^(wix|wordpress)$")
    html: str
    metadata: BlogSEOMetadataResponse
    schedule_time: Optional[str] = None


class BlogPublishResponse(BaseModel):
    success: bool = True
    platform: str
    url: Optional[str] = None
    post_id: Optional[str] = None
    error: Optional[str] = None


class HallucinationCheckRequest(BaseModel):
    content: str
    sources: List[str] = []


class HallucinationCheckResponse(BaseModel):
    success: bool = True
    claims: List[Dict[str, Any]] = []
    suggestions: List[Dict[str, Any]] = []


# -----------------------
# Medium Blog Generation
# -----------------------

class MediumSectionOutline(BaseModel):
    """Lightweight outline payload for medium blog generation."""
    id: str
    heading: str
    keyPoints: List[str] = []
    subheadings: List[str] = []
    keywords: List[str] = []
    targetWords: Optional[int] = None
    references: List[ResearchSource] = []


class MediumBlogGenerateRequest(BaseModel):
    """Request to generate an entire medium-length blog in one pass."""
    title: str
    sections: List[MediumSectionOutline]
    persona: Optional[PersonaInfo] = None
    tone: Optional[str] = None
    audience: Optional[str] = None
    globalTargetWords: Optional[int] = 1000
    researchKeywords: Optional[List[str]] = None  # Original research keywords for better caching


class MediumGeneratedSection(BaseModel):
    id: str
    heading: str
    content: str
    wordCount: int
    sources: Optional[List[ResearchSource]] = None


class MediumBlogGenerateResult(BaseModel):
    success: bool = True
    title: str
    sections: List[MediumGeneratedSection]
    model: Optional[str] = None
    generation_time_ms: Optional[int] = None
    safety_flags: Optional[Dict[str, Any]] = None