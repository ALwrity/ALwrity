"""
Tests for the AI prompt context builder (Phase B #10/#29 follow-up).

The strategy generator's six component prompts previously dumped the ENTIRE
raw ``context`` dict (``json.dumps(context, indent=2)``) into the LLM prompt.
That put the user's 30 form fields into the prompt, but as opaque structured
noise — nothing told the model WHAT each value meant or that it was the user's
explicit input, so the output wasn't reliably personalized.

The fix renders ``form_data`` + key onboarding signals into a clean,
natural-language "User & Business Intelligence" briefing (prompt_builder.py),
injected into every component prompt. These tests pin that behavior.
"""
import pytest

from api.content_planning.services.content_strategy.ai_generation.prompt_builder import (
    UserIntelligenceFormatter,
)


class TestFormatFormData:
    def test_no_form_data_returns_empty(self):
        assert UserIntelligenceFormatter.format_form_data({}) == ""
        assert UserIntelligenceFormatter.format_form_data(None) == ""

    def test_groups_canonical_fields_under_category_headers(self):
        briefing = UserIntelligenceFormatter.format_form_data(
            {
                "business_objectives": "scale platform",
                "brand_voice": "Professional",
                "content_frequency": "Weekly",
                "top_competitors": ["Acme", "Beta"],
            }
        )
        assert "Business Context:" in briefing
        assert "Content Strategy:" in briefing
        assert "Competitive Intelligence:" in briefing
        # Natural-language labels, not raw JSON keys
        assert "Business Objectives: scale platform" in briefing
        assert "Brand Voice / Tone: Professional" in briefing
        assert "Content Publishing Frequency: Weekly" in briefing

    def test_renders_values_unwrapped_not_raw_json(self):
        # The point: a readable briefing, NOT a dump of dict/list JSON.
        briefing = UserIntelligenceFormatter.format_form_data(
            {"top_competitors": ["Acme", "Beta"]}
        )
        assert "['Acme', 'Beta']" not in briefing
        assert "Acme" in briefing

    def test_skips_empty_values(self):
        briefing = UserIntelligenceFormatter.format_form_data(
            {"team_size": "", "content_budget": None, "brand_voice": "Authoritative"}
        )
        assert "Team Size" not in briefing
        assert "Content Budget" not in briefing
        assert "Brand Voice / Tone" in briefing

    def test_supports_legacy_generic_keys(self):
        briefing = UserIntelligenceFormatter.format_form_data(
            {"name": "Acme SaaS", "industry": "saas"}
        )
        assert "Industry: saas" in briefing
        assert "Acme SaaS" in briefing


class TestBuildBriefing:
    def test_produces_a_workable_briefing(self):
        briefing = UserIntelligenceFormatter.build_briefing(
            {
                "form_data": {"business_objectives": "scale", "brand_voice": "Friendly"},
                "onboarding_data": {
                    "website_analysis": {"website_url": "https://acme.com"},
                    "persona_data": {
                        "core_persona": {
                            "role": "CTO",
                            "goals": ["scale"],
                            "pain_points": ["visibility"],
                        }
                    },
                    "gsc_analytics": {"total_clicks": 100, "total_impressions": 1000},
                },
            }
        )
        assert "Who this plan is for" in briefing
        assert "Business Objectives: scale" in briefing
        assert "Brand Voice / Tone: Friendly" in briefing
        assert "https://acme.com" in briefing
        assert "CTO" in briefing
        assert "100 clicks / 1000 impressions" in briefing

    def test_empty_context_still_renderable(self):
        briefing = UserIntelligenceFormatter.build_briefing({})
        assert "Who this plan is for" in briefing
        assert "(No explicit user-provided strategy fields were supplied.)" in briefing


class TestBriefingEnrichment:
    """QA-1: onboarding context enrichment (competitors, voice & style, Bing,
    data-quality note) must reach the briefing."""

    @staticmethod
    def _rich_onboarding():
        return {
            "website_analysis": {
                "website_url": "https://acme.com",
                "writing_style": {
                    "tone": "professional",
                    "voice": "authoritative",
                    "complexity": "moderate",
                    "engagement_level": "high",
                },
                "content_type": {
                    "primary_type": "blog posts",
                    "secondary_types": ["case studies", "explainers"],
                    "purpose": "educate buyers",
                },
            },
            "competitor_analysis": {
                "competitors": [
                    {"name": "Acme Rival", "domain": "rival.com"},
                    {"name": "Beta Corp", "domain": "beta.io"},
                ]
            },
            "deep_competitor_analysis": {
                "competitors": [
                    {
                        "name": "Acme Rival",
                        "strategy_summary": "Doubles down on SEO guides",
                    }
                ]
            },
            "gsc_analytics": {"total_clicks": 100, "total_impressions": 1000},
            "bing_analytics": {"total_clicks": 50, "total_impressions": 500},
            "data_quality": {"overall_score": 0.85, "completeness": 0.9},
        }

    def test_competitor_watchlist_reaches_briefing(self):
        briefing = UserIntelligenceFormatter.build_briefing(
            {"onboarding_data": self._rich_onboarding()}
        )
        assert "Competitor watchlist" in briefing
        assert "Acme Rival (rival.com)" in briefing
        assert "Beta Corp (beta.io)" in briefing
        # Deep-analysis signal surfaces as context, not just the bare name
        assert "SEO guides" in briefing

    def test_voice_and_style_reach_briefing(self):
        briefing = UserIntelligenceFormatter.build_briefing(
            {"onboarding_data": self._rich_onboarding()}
        )
        assert "Their voice & style:" in briefing
        assert "Tone: professional" in briefing
        assert "Voice: authoritative" in briefing
        assert "Preferred primary format: blog posts" in briefing

    def test_bing_analytics_reaches_briefing(self):
        briefing = UserIntelligenceFormatter.build_briefing(
            {"onboarding_data": self._rich_onboarding()}
        )
        assert "100 clicks / 1000 impressions" in briefing
        assert "50 clicks / 500 impressions (Bing)" in briefing

    def test_data_quality_note_reaches_briefing(self):
        briefing = UserIntelligenceFormatter.build_briefing(
            {"onboarding_data": self._rich_onboarding()}
        )
        assert "Stored onboarding data quality: strong (score 0.85)" in briefing

    def test_missing_sources_render_no_bogus_sections(self):
        briefing = UserIntelligenceFormatter.build_briefing(
            {"onboarding_data": {"website_analysis": {"website_url": "https://x.com"}}}
        )
        assert "Competitor watchlist" not in briefing
        assert "Their voice & style:" not in briefing
        assert "Existing organic footprint:" not in briefing
        assert "Stored onboarding data quality:" not in briefing
        assert "Website: https://x.com" in briefing

    def test_string_writing_style_and_bare_competitor_list(self):
        # minimal_onboarding-style shapes: writing_style is a plain string and
        # competitor_analysis may already be a flat list.
        onb = {
            "website_analysis": {
                "writing_style": "professional",
                "content_type": ["blog", "guide"],
            },
            "competitor_analysis": [
                {"name": "Competitor", "domain": "competitor.com"}
            ],
            "gsc_analytics": {"metrics": {"total_clicks": 10, "total_impressions": 9}},
        }
        briefing = UserIntelligenceFormatter.build_briefing({"onboarding_data": onb})
        assert "Tone / voice: professional" in briefing
        assert "Preferred content types: blog, guide" in briefing
        assert "Competitor (competitor.com)" in briefing
        assert "10 clicks / 9 impressions" in briefing
