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
