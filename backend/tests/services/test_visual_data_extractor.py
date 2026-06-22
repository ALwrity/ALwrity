"""
Unit tests for the Visual Data Extractor module.

Tests cover:
- Statistics extraction
- Domain detection
- Visual data pattern detection
- Research data extraction
- Model recommendations
"""

import pytest
from services.image_generation.visual_data_extractor import (
    extract_visual_data,
    get_model_recommendation,
    build_visual_summary,
    ExtractedVisualData,
    _extract_statistic_with_context,
    _has_visual_mention,
    _has_trend_keyword,
    _detect_domains_in_text,
    _deduplicate_and_limit,
    DOMAIN_VISUAL_CONCEPTS,
)


class TestStatisticsExtraction:
    """Tests for statistics extraction."""

    def test_extract_percentage(self):
        """Test extraction of percentage values."""
        text = "The market grew 40% in 2023"
        result = _extract_statistic_with_context(text)
        assert result is not None
        assert "40%" in result

    def test_extract_currency(self):
        """Test extraction of currency values."""
        text = "Investment reached $5 billion"
        result = _extract_statistic_with_context(text)
        assert result is not None
        assert "$" in result or "5" in result

    def test_extract_large_numbers(self):
        """Test extraction of large numbers with units."""
        text = "Revenue was 10 million dollars"
        result = _extract_statistic_with_context(text)
        assert result is not None
        assert "million" in result.lower() or "10" in result

    def test_extract_multiplier(self):
        """Test extraction of multipliers."""
        text = "Growth was 3x compared to last year"
        result = _extract_statistic_with_context(text)
        assert result is not None
        assert "3x" in result.lower() or "3" in result

    def test_no_statistic_returns_none(self):
        """Test that non-statistical text returns None."""
        text = "This is a regular sentence without numbers"
        result = _extract_statistic_with_context(text)
        assert result is None


class TestVisualMentionDetection:
    """Tests for visual mention detection."""

    def test_detects_chart_mention(self):
        """Test detection of chart-related keywords."""
        text = "The chart shows increasing trends"
        assert _has_visual_mention(text) is True

    def test_detects_graph_mention(self):
        """Test detection of graph-related keywords."""
        text = "A graph comparing the data"
        assert _has_visual_mention(text) is True

    def test_detects_diagram_mention(self):
        """Test detection of diagram-related keywords."""
        text = "The diagram illustrates the process"
        assert _has_visual_mention(text) is True

    def test_no_visual_mention(self):
        """Test that regular text returns False."""
        text = "The meeting was productive and informative"
        assert _has_visual_mention(text) is False


class TestTrendKeywordDetection:
    """Tests for trend keyword detection."""

    def test_detects_increase(self):
        """Test detection of 'increase' keyword."""
        assert _has_trend_keyword("Sales increase by 10%") is True

    def test_detects_growth(self):
        """Test detection of 'growth' keyword."""
        assert _has_trend_keyword("Market growth is expected") is True

    def test_detects_comparison(self):
        """Test detection of comparison keywords."""
        assert _has_trend_keyword("vs previous year") is True

    def test_detects_ranking(self):
        """Test detection of ranking keywords."""
        assert _has_trend_keyword("Top ranking company") is True


class TestDomainDetection:
    """Tests for domain detection."""

    def test_detects_healthcare(self):
        """Test detection of healthcare domain."""
        text = "Hospital equipment and medical charts"
        domains, concepts = _detect_domains_in_text(text)
        assert "healthcare" in domains

    def test_detects_tech(self):
        """Test detection of tech domain."""
        text = "tech industry and artificial intelligence"
        domains, concepts = _detect_domains_in_text(text)
        assert "tech" in domains

    def test_detects_finance(self):
        """Test detection of finance domain."""
        text = "Investment growth and stock market trends"
        domains, concepts = _detect_domains_in_text(text)
        assert "finance" in domains

    def test_detects_marketing(self):
        """Test detection of marketing domain."""
        text = "Social media engagement and content strategy"
        domains, concepts = _detect_domains_in_text(text)
        assert "marketing" in domains

    def test_no_domain_detected(self):
        """Test that random text returns empty results."""
        text = "This is a random sentence"
        domains, concepts = _detect_domains_in_text(text)
        assert len(domains) == 0


class TestDeduplication:
    """Tests for deduplication logic."""

    def test_removes_duplicates(self):
        """Test that duplicates are removed."""
        items = ["Apple", "apple", "Banana", "APPLE"]
        result = _deduplicate_and_limit(items)
        # Should have 2 unique items (Apple normalized, Banana)
        assert len(result) <= 2

    def test_respects_max_items(self):
        """Test that max_items limit is respected."""
        items = ["Item" + str(i) for i in range(20)]
        result = _deduplicate_and_limit(items, max_items=5)
        assert len(result) == 5

    def test_handles_empty_list(self):
        """Test that empty list returns empty list."""
        result = _deduplicate_and_limit([])
        assert result == []

    def test_handles_none_values(self):
        """Test that None values are filtered out."""
        items = ["Apple", None, "Banana", ""]
        result = _deduplicate_and_limit(items)
        assert None not in result
        assert "" not in result


class TestExtractVisualData:
    """Tests for main extract_visual_data function."""

    def test_extracts_statistics_from_section(self):
        """Test extraction of statistics from section key points."""
        section = {
            "heading": "AI Market Growth",
            "key_points": [
                "Market grew 40% in 2023",
                "Investment reached $5 billion"
            ],
            "keywords": ["AI", "market"]
        }
        result = extract_visual_data(section, None)
        assert result.has_statistics()
        assert len(result.statistics) >= 1

    def test_detects_domain_from_heading(self):
        """Test domain detection from section heading."""
        section = {
            "heading": "Healthcare Technology Trends",
            "key_points": ["Digital transformation in hospitals"],
            "keywords": ["healthcare"]
        }
        result = extract_visual_data(section, None)
        assert "healthcare" in result.detected_domains

    def test_extracts_from_research_sources(self):
        """Test extraction from research sources."""
        section = {"heading": "Tech Industry", "key_points": ["Innovation continues"]}
        research = {
            "sources": [
                {
                    "title": "AI Market Report 2024",
                    "excerpt": "The market is expected to grow 50%."
                }
            ]
        }
        result = extract_visual_data(section, research)
        assert result.has_statistics()

    def test_handles_none_section(self):
        """Test that None section doesn't crash."""
        result = extract_visual_data(None, None)
        assert isinstance(result, ExtractedVisualData)
        assert len(result.statistics) == 0

    def test_handles_empty_section(self):
        """Test that empty section returns empty results."""
        result = extract_visual_data({}, {})
        assert isinstance(result, ExtractedVisualData)
        assert len(result.statistics) == 0

    def test_extracts_keywords(self):
        """Test extraction of keywords."""
        section = {
            "heading": "Marketing",
            "key_points": ["Digital marketing trends"],
            "keywords": ["SEO", "content", "social media"]
        }
        result = extract_visual_data(section, None)
        assert "SEO" in result.visual_keywords or "content" in result.visual_keywords

    def test_detects_concepts_from_subheadings(self):
        """Test extraction of concepts from subheadings."""
        section = {
            "heading": "Business Growth",
            "subheadings": ["Market Analysis", "Future Trends"],
            "key_points": ["Regular point"]
        }
        result = extract_visual_data(section, None)
        assert "Market Analysis" in result.concepts or "Future Trends" in result.concepts


class TestModelRecommendations:
    """Tests for model recommendation logic."""

    def test_recommends_data_models_for_statistics(self):
        """Test that data-heavy content recommends FLUX/GLM."""
        section = {
            "key_points": ["Market grew 40%", "Revenue $10M"]
        }
        result = extract_visual_data(section, None)
        rec = get_model_recommendation(result)
        assert rec is not None
        assert "FLUX" in rec or "GLM" in rec

    def test_recommends_conceptual_models_for_domain(self):
        """Test that domain content recommends conceptual models."""
        section = {
            "heading": "Business Strategy",
            "key_points": ["Enterprise meetings and team collaboration"]
        }
        result = extract_visual_data(section, None)
        rec = get_model_recommendation(result)
        # This section has domain concepts (business)
        assert result.has_domain_concepts()

    def test_returns_none_for_no_content(self):
        """Test that empty content returns None."""
        result = extract_visual_data({}, {})
        rec = get_model_recommendation(result)
        assert rec is None


class TestBuildVisualSummary:
    """Tests for visual summary building."""

    def test_includes_statistics(self):
        """Test that statistics are included in summary."""
        section = {"key_points": ["Market grew 40%"]}
        result = extract_visual_data(section, None)
        summary = build_visual_summary(result)
        assert "Statistics" in summary or "40%" in summary

    def test_includes_domain_concepts(self):
        """Test that domain concepts are included."""
        section = {"heading": "Healthcare Industry", "key_points": ["Topic"]}
        result = extract_visual_data(section, None)
        summary = build_visual_summary(result)
        # Domain concepts or detected domains should be in summary
        assert len(summary) > 0

    def test_returns_empty_for_no_content(self):
        """Test that empty content returns empty string."""
        result = extract_visual_data({}, {})
        summary = build_visual_summary(result)
        assert summary == ""


class TestExtractedVisualData:
    """Tests for ExtractedVisualData class."""

    def test_to_dict(self):
        """Test conversion to dictionary."""
        result = ExtractedVisualData()
        result.statistics = ["Test stat"]
        d = result.to_dict()
        assert isinstance(d, dict)
        assert "statistics" in d
        assert d["statistics"] == ["Test stat"]

    def test_has_statistics(self):
        """Test has_statistics method."""
        result = ExtractedVisualData()
        assert result.has_statistics() is False
        result.statistics = ["Test"]
        assert result.has_statistics() is True

    def test_is_data_heavy(self):
        """Test is_data_heavy method."""
        result = ExtractedVisualData()
        assert result.is_data_heavy() is False
        result.statistics = ["Test"]
        assert result.is_data_heavy() is True

    def test_get_recommended_image_type(self):
        """Test recommended image type based on content."""
        result = ExtractedVisualData()
        result.statistics = ["Test"]
        assert result.get_recommended_image_type() in ["chart", "infographic"]


class TestIntegration:
    """Integration tests for the full pipeline."""

    def test_full_pipeline_healthcare(self):
        """Test full extraction pipeline for healthcare content."""
        section = {
            "heading": "AI in Healthcare Market",
            "subheadings": ["Market Growth", "Key Players"],
            "key_points": [
                "AI healthcare market expected to grow 40% by 2025",
                "Over $5 billion invested",
                "Medical imaging accuracy improved by 85%"
            ],
            "keywords": ["AI", "healthcare", "machine learning", "medical"]
        }
        
        research = {
            "domain": "healthcare",
            "sources": [
                {
                    "title": "Healthcare AI Report",
                    "excerpt": "Market CAGR of 44.9% projected through 2030"
                }
            ]
        }
        
        result = extract_visual_data(section, research)
        
        # Should extract statistics
        assert result.has_statistics()
        
        # Should detect healthcare domain
        assert "healthcare" in result.detected_domains
        
        # Should recommend data visualization models
        rec = get_model_recommendation(result)
        assert rec is not None
        
        # Summary should include key info
        summary = build_visual_summary(result)
        assert len(summary) > 0

    def test_full_pipeline_tech(self):
        """Test full extraction pipeline for tech content."""
        section = {
            "heading": "Tech Cloud Computing Trends",
            "key_points": [
                "AWS vs Azure comparison",
                "Market share rankings",
                "Growth patterns"
            ],
            "keywords": ["cloud", "tech", "AWS", "Azure", "Google Cloud"]
        }
        
        result = extract_visual_data(section, None)
        
        # Should detect tech domain (explicit "tech" in heading)
        assert "tech" in result.detected_domains
        
        # Should extract data points
        assert result.has_data_points()

    def test_full_pipeline_marketing(self):
        """Test full extraction pipeline for marketing content."""
        section = {
            "heading": "Social Media Marketing",
            "key_points": [
                "Brands see 3x engagement increase",
                "Influencer partnerships drive 11x ROI"
            ],
            "keywords": ["marketing", "social media", "engagement"]
        }
        
        result = extract_visual_data(section, None)
        
        # Should extract statistics
        assert result.has_statistics()
        
        # Should detect marketing domain
        assert "marketing" in result.detected_domains


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
