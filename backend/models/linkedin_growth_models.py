from datetime import datetime
from typing import List, Literal, Optional
from pydantic import BaseModel, Field


class TrendingTopicItem(BaseModel):
    topic: str = Field(..., description="Short label for the trending topic (2-4 words)")
    emoji: str = Field(..., description="Single relevant emoji")
    why_now: str = Field(..., description="One-sentence explanation of why this matters right now")
    suggested_hook: str = Field(..., description="LinkedIn post hook the user could write")
    data_source_detail: str = Field(
        ..., description="Brief explanation of what data this insight comes from"
    )
    confidence: Literal["high", "medium", "low"] = Field(
        ..., description="How confident the system is in this topic's relevance"
    )


class TrendingTopicsResponse(BaseModel):
    industry: str = Field(..., description="The industry these topics pertain to")
    trending_topics: List[TrendingTopicItem] = Field(
        default_factory=list, description="Top trending topics"
    )
    data_source_summary: str = Field(
        ..., description="Transparency note about where the data comes from"
    )
    generated_at: datetime = Field(
        ..., description="When this response was generated"
    )


class NetworkSuggestionItem(BaseModel):
    name: str = Field(..., description="Full name of the suggested connection")
    title: str = Field(..., description="Professional title/role")
    company: str = Field(..., description="Company or organization")
    why_connect: str = Field(
        ..., description="One-sentence explanation of why this is a good connection"
    )
    suggested_note: str = Field(
        ..., description="Personalized LinkedIn connection note the user can send"
    )
    data_source_detail: str = Field(
        ..., description="Brief explanation of what data this insight comes from"
    )
    confidence: Literal["high", "medium", "low"] = Field(
        ..., description="How confident the system is in this suggestion"
    )


class NetworkSuggestionsResponse(BaseModel):
    suggestions: List[NetworkSuggestionItem] = Field(
        default_factory=list, description="People to connect with this week"
    )
    data_source_summary: str = Field(
        ..., description="Transparency note about where the data comes from"
    )
    generated_at: datetime = Field(
        ..., description="When this response was generated"
    )


class EngagementOpportunityItem(BaseModel):
    title: str = Field(..., description="Title of the post or article")
    author: str = Field(..., description="Author's name")
    author_context: str = Field(
        ..., description="Context about the author (e.g. thought leader in SaaS, your network)"
    )
    why_engage: str = Field(
        ..., description="One-sentence explanation of why engaging is valuable"
    )
    suggested_comment: str = Field(
        ..., description="A thoughtful comment the user could post"
    )
    data_source_detail: str = Field(
        ..., description="Brief explanation of what data this insight comes from"
    )
    confidence: Literal["high", "medium", "low"] = Field(
        ..., description="How confident the system is in this opportunity"
    )


class EngagementOpportunitiesResponse(BaseModel):
    opportunities: List[EngagementOpportunityItem] = Field(
        default_factory=list, description="Posts to engage with"
    )
    data_source_summary: str = Field(
        ..., description="Transparency note about where the data comes from"
    )
    generated_at: datetime = Field(
        ..., description="When this response was generated"
    )


class PreviewScoreRequest(BaseModel):
    content: str = Field(..., description="The LinkedIn post draft to analyze", min_length=1)
    context: Optional[str] = Field(
        None, description="Optional context about the post (topic, target audience, etc.)"
    )


class PostPreviewDimension(BaseModel):
    dimension: str = Field(
        ..., description="The scoring dimension name (e.g. Clarity, Engagement Potential)"
    )
    score: int = Field(
        ..., description="Score from 0-100", ge=0, le=100
    )
    feedback: str = Field(
        ..., description="Actionable feedback to improve this dimension"
    )
    data_source_detail: str = Field(
        ..., description="Brief explanation of what data this score is based on"
    )
    confidence: Literal["high", "medium", "low"] = Field(
        ..., description="How confident the system is in this score"
    )


class PostPreviewScoreResponse(BaseModel):
    overall_score: int = Field(
        ..., description="Overall score from 0-100", ge=0, le=100
    )
    dimensions: List[PostPreviewDimension] = Field(
        default_factory=list, description="Individual dimension scores"
    )
    top_improvement: str = Field(
        ..., description="Single most impactful suggestion for improvement"
    )
    data_source_summary: str = Field(
        ..., description="Transparency note about where the data comes from"
    )
    generated_at: datetime = Field(
        ..., description="When this response was generated"
    )


class ViralPattern(BaseModel):
    pattern_name: str = Field(
        ..., description="Short label for the viral pattern (e.g. Hot take + data point)"
    )
    description: str = Field(
        ..., description="Explanation of what this pattern is and why it works"
    )
    engagement_multiplier: str = Field(
        ..., description="Estimated engagement impact (e.g. 3x engagement)"
    )
    example_headline: str = Field(
        ..., description="Example post headline that uses this pattern"
    )
    example_author: str = Field(
        ..., description="Name of the person who posted the example"
    )
    data_source_detail: str = Field(
        ..., description="Brief explanation of what data this pattern comes from"
    )
    confidence: Literal["high", "medium", "low"] = Field(
        ..., description="How confident the system is in this pattern"
    )


class ViralAnalysisResponse(BaseModel):
    industry: str = Field(..., description="The industry being analyzed")
    patterns: List[ViralPattern] = Field(
        default_factory=list, description="Identified viral content patterns"
    )
    top_recommendation: str = Field(
        ..., description="Single most impactful pattern to use right now"
    )
    data_source_summary: str = Field(
        ..., description="Transparency note about where the data comes from"
    )
    generated_at: datetime = Field(
        ..., description="When this response was generated"
    )


class DailyPostIdea(BaseModel):
    day: str = Field(..., description="Day of the week (Monday, Tuesday, etc.)")
    content_type: str = Field(
        ..., description="Type of post (How-to, Case study, Hot take, etc.)"
    )
    headline: str = Field(
        ..., description="Catchy headline for the post idea"
    )
    hook: str = Field(
        ..., description="The opening hook to grab attention"
    )
    why_this_works: str = Field(
        ..., description="One-sentence explanation of why this post will perform well"
    )
    data_source_detail: str = Field(
        ..., description="Brief explanation of what data this idea comes from"
    )
    confidence: Literal["high", "medium", "low"] = Field(
        ..., description="How confident the system is in this idea"
    )


class WeeklyStrategyResponse(BaseModel):
    theme: str = Field(
        ..., description="The overarching theme for the week (e.g. Share your process)"
    )
    week_of: str = Field(
        ..., description="The start date of this strategy week (ISO format)"
    )
    daily_posts: List[DailyPostIdea] = Field(
        default_factory=list, description="One post idea per weekday"
    )
    key_topics: List[str] = Field(
        default_factory=list, description="3-5 key topics to cover this week"
    )
    focus_area: str = Field(
        ..., description="The primary focus for this week (e.g. Authority building)"
    )
    data_source_summary: str = Field(
        ..., description="Transparency note about where the data comes from"
    )
    generated_at: datetime = Field(
        ..., description="When this response was generated"
    )


class ContentGapItem(BaseModel):
    gap_topic: str = Field(
        ..., description="The topic the user hasn't covered (e.g. AI/ML in your industry)"
    )
    why_gap: str = Field(
        ..., description="Explanation of why this topic is missing from their content"
    )
    why_it_matters: str = Field(
        ..., description="Why they should cover this topic now"
    )
    suggested_angle: str = Field(
        ..., description="A specific post angle to fill this gap"
    )
    data_source_detail: str = Field(
        ..., description="Brief explanation of what data this gap comes from"
    )
    confidence: Literal["high", "medium", "low"] = Field(
        ..., description="How confident the system is in this gap"
    )


class ContentGapsResponse(BaseModel):
    gaps: List[ContentGapItem] = Field(
        default_factory=list, description="Identified content gaps"
    )
    data_source_summary: str = Field(
        ..., description="Transparency note about where the data comes from"
    )
    generated_at: datetime = Field(
        ..., description="When this response was generated"
    )


class BrandDimension(BaseModel):
    dimension: str = Field(
        ..., description="The brand dimension name (e.g. Profile Completeness)"
    )
    score: int = Field(
        ..., description="Score from 0-100", ge=0, le=100
    )
    feedback: str = Field(
        ..., description="Actionable feedback to improve this dimension"
    )
    data_source_detail: str = Field(
        ..., description="Brief explanation of what data this score is based on"
    )
    confidence: Literal["high", "medium", "low"] = Field(
        ..., description="How confident the system is in this score"
    )


class BrandScorecardResponse(BaseModel):
    overall_score: int = Field(
        ..., description="Overall brand score from 0-100", ge=0, le=100
    )
    dimensions: List[BrandDimension] = Field(
        default_factory=list, description="Individual brand dimension scores"
    )
    top_recommendation: str = Field(
        ..., description="Single most impactful suggestion to improve your brand"
    )
    data_source_summary: str = Field(
        ..., description="Transparency note about where the data comes from"
    )
    generated_at: datetime = Field(
        ..., description="When this response was generated"
    )


class ConsolidatedGrowthResponse(BaseModel):
    trending: Optional[TrendingTopicsResponse] = Field(
        None, description="Trending topics in the user's industry"
    )
    network_suggestions: Optional[NetworkSuggestionsResponse] = Field(
        None, description="People to connect with this week"
    )
    engagement_opportunities: Optional[EngagementOpportunitiesResponse] = Field(
        None, description="Posts to engage with"
    )
    viral_analysis: Optional[ViralAnalysisResponse] = Field(
        None, description="Viral content patterns in user's industry"
    )
    weekly_strategy: Optional[WeeklyStrategyResponse] = Field(
        None, description="Weekly LinkedIn content strategy"
    )
    content_gaps: Optional[ContentGapsResponse] = Field(
        None, description="Content gaps in the user's strategy"
    )
    brand_scorecard: Optional[BrandScorecardResponse] = Field(
        None, description="Personal brand strength evaluation"
    )
    generated_at: datetime = Field(
        default_factory=datetime.now,
        description="When this consolidated response was generated",
    )
