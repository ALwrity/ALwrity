"""
Tests for services/seo_tools/onboarding_insights (prompt, schema, parser,
validator) powering the Strategic Content Opportunities LLM call.

Pins down the contract for the enriched, grounded single call:

- Schema: all 10 sections present; original 5 required (backwards
  compatibility); opportunity items expose the common fields incl. a
  priority enum; channel_playbook has channel + recommendations.
- Prompt: embeds the core sitemap facts, competitors/industry context, the
  GROUND-TRUTH CONTEXT digest sections (when provided, omitted when empty),
  keyword clusters and strategic pillars.
- Parser: always returns the canonical defaults for the original 5 keys,
  preserves the new grounded sections, keeps unknown future keys, turns
  plain strings/objects into single-item lists, and falls back to defaults
  on unparseable input (incl. fenced JSON, invalid JSON).
- Validator: counts populated fields, surfaces field errors without raw
  content, tolerates partial data.

No network and no LLM are used.
"""

import services.seo_tools.onboarding_insights as ins

_OPP_FIELDS = {"title", "topic", "rationale", "impact", "effort", "priority", "action", "evidence"}

_NEW_SECTIONS = [
    "quick_wins",
    "keyword_topic_opportunities",
    "audience_fit_opportunities",
    "channel_playbook",
    "pillar_expansion",
]


# ---------------------------------------------------------------- schema


def test_schema_has_all_sections():
    schema = ins.onboarding_insights_json_schema()
    props = schema["properties"]
    assert set(props) == set(ins.ONBOARDING_INSIGHTS_DEFAULTS)
    assert schema["required"] == [
        "competitive_positioning",
        "content_gaps",
        "growth_opportunities",
        "industry_benchmarks",
        "strategic_recommendations",
    ]


def test_schema_opportunity_items_have_common_fields():
    schema = ins.onboarding_insights_json_schema()
    for section in ["content_gaps", "growth_opportunities", "strategic_recommendations"] + _NEW_SECTIONS:
        if section == "channel_playbook":
            continue
        item = schema["properties"][section]["items"]
        assert item["type"] == "object"
        assert set(item["properties"]) == _OPP_FIELDS
        assert item["properties"]["priority"]["enum"] == ["high", "medium", "low"]


def test_schema_channel_playbook_shape():
    item = ins.onboarding_insights_json_schema()["properties"]["channel_playbook"]["items"]
    assert item["properties"]["channel"]["type"] == "string"
    assert item["properties"]["recommendations"]["type"] == "array"
    assert item["properties"]["recommendations"]["items"]["type"] == "string"


def test_system_prompt_grounds_and_forbids_fabrication():
    prompt = ins.get_onboarding_system_prompt()
    assert "Ground every insight in the provided context" in prompt
    assert "Never fabricate competitor facts" in prompt
    assert "MUST be a single valid minified JSON object" in prompt


# ----------------------------------------------------------------- prompt


def _base_structure():
    return {
        "total_urls": 120,
        "url_patterns": {"blog": 60, "guides": 30, "landing": 30},
        "average_path_depth": 2,
        "keyword_clusters": {"seo": 12, "content marketing": 8},
        "strategic_pillars": ["SEO", "CRO"],
    }


def _base_trends():
    return {"publishing_velocity": 2}


def test_prompt_contains_core_site_facts():
    prompt = ins.build_onboarding_analysis_prompt(
        _base_structure(), _base_trends(), {}, "https://example.com", None, None
    )
    assert "https://example.com" in prompt
    assert "Total URLs: 120" in prompt
    assert "Average Path Depth: 2" in prompt
    assert "2.00 posts/day" in prompt
    assert "- blog: 60 URLs" in prompt


def test_prompt_embeds_competitor_and_industry_context():
    prompt = ins.build_onboarding_analysis_prompt(
        _base_structure(), _base_trends(), {},
        "https://example.com",
        ["https://a.com", "https://b.com"],
        "The B2B SaaS industry is consolidating.",
    )
    assert "Competitors to consider: https://a.com, https://b.com" in prompt
    assert "Industry Context: The B2B SaaS industry is consolidating." in prompt


def test_prompt_embeds_ground_truth_digest_sections():
    context = {
        "AUDIENCE & BRAND VOICE": "audience = B2B marketers",
        "COMPETITOR INTEL (GROUNDED)": "competitor.com threat=high",
    }
    prompt = ins.build_onboarding_analysis_prompt(
        _base_structure(), _base_trends(), {}, "https://example.com", None, None,
        context=context,
    )
    assert "GROUND-TRUTH CONTEXT" in prompt
    assert "AUDIENCE & BRAND VOICE: audience = B2B marketers" in prompt
    assert "COMPETITOR INTEL (GROUNDED): competitor.com threat=high" in prompt


def test_prompt_omits_ground_truth_when_empty():
    prompt = ins.build_onboarding_analysis_prompt(
        _base_structure(), _base_trends(), {}, "https://example.com", None, None, context={}
    )
    assert "AUDIENCE & BRAND VOICE" not in prompt
    assert "COMPETITOR INTEL (GROUNDED)" not in prompt


def test_prompt_embeds_keyword_clusters_and_pillars():
    prompt = ins.build_onboarding_analysis_prompt(
        _base_structure(), _base_trends(), {}, "https://example.com", None, None
    )
    assert "Keyword Clusters (from URL slugs):" in prompt
    assert "- seo: 12 URLs" in prompt
    assert "Strategic Pillars Detected:" in prompt
    assert "- SEO" in prompt


def test_prompt_handles_absent_sections():
    prompt = ins.build_onboarding_analysis_prompt({}, {}, {}, "https://example.com")
    assert "Total URLs: 0" in prompt
    assert "AUDIENCE & BRAND VOICE" not in prompt


# ----------------------------------------------------------------- parser


def test_parser_none_returns_defaults():
    assert ins.parse_onboarding_insights(None) == dict(ins.ONBOARDING_INSIGHTS_DEFAULTS)


def test_parser_unparseable_string_returns_defaults():
    assert ins.parse_onboarding_insights("this is not json") == dict(ins.ONBOARDING_INSIGHTS_DEFAULTS)


def test_parser_merges_partial_dict_over_defaults():
    result = ins.parse_onboarding_insights({"growth_opportunities": [{"title": "Expand into X"}]})
    assert result["competitive_positioning"] == "Analysis in progress..."
    assert result["content_gaps"] == []
    assert result["growth_opportunities"] == [{"title": "Expand into X"}]
    assert result["industry_benchmarks"] == []
    assert result["strategic_recommendations"] == []


def test_parser_preserves_new_grounded_sections():
    payload = {
        "competitive_positioning": "Leading in mid-market SEO",
        "quick_wins": [{"title": "Add FAQ schema"}],
        "keyword_topic_opportunities": [{"topic": "programmatic SEO"}],
        "audience_fit_opportunities": [{"title": "Beginner checklist"}],
        "channel_playbook": [{"channel": "LinkedIn", "recommendations": ["Post 3x/week"]}],
        "pillar_expansion": [{"title": "Expand SEO Guides"}],
    }
    result = ins.parse_onboarding_insights(payload)
    assert result["competitive_positioning"] == "Leading in mid-market SEO"
    for section in _NEW_SECTIONS:
        assert result[section] == payload[section]


def test_parser_preserves_unknown_future_keys():
    result = ins.parse_onboarding_insights({"future_section": {"anything": 1}})
    assert result["future_section"] == {"anything": 1}


def test_parser_handles_string_response():
    payload = '{"competitive_positioning": "Mid-market leader", "quick_wins": [{"title": "Fix titles"}]}'
    result = ins.parse_onboarding_insights(payload)
    assert result["competitive_positioning"] == "Mid-market leader"
    assert result["quick_wins"] == [{"title": "Fix titles"}]


def test_parser_handles_fenced_json():
    payload = '```json\n{"competitive_positioning": "Leader", "content_gaps": [{"title": "Gap"}]}\n```'
    result = ins.parse_onboarding_insights(payload)
    assert result["competitive_positioning"] == "Leader"
    assert result["content_gaps"] == [{"title": "Gap"}]


def test_parser_coerces_string_and_dict_items_to_lists():
    result = ins.parse_onboarding_insights(
        {"content_gaps": "one gap", "quick_wins": {"title": "single win"}, "industry_benchmarks": 42}
    )
    assert result["content_gaps"] == ["one gap"]
    assert result["quick_wins"] == [{"title": "single win"}]
    assert result["industry_benchmarks"] == []


def test_parser_recovers_non_dict_object():
    result = ins.parse_onboarding_insights(["not", "a", "dict"])
    assert result == dict(ins.ONBOARDING_INSIGHTS_DEFAULTS)


# --------------------------------------------------------------- validator


def test_validate_counts_all_populated_fields():
    payload = dict(ins.ONBOARDING_INSIGHTS_DEFAULTS)
    payload["competitive_positioning"] = "Leader"
    payload["content_gaps"] = [{"title": "Gap"}]
    payload["growth_opportunities"] = [{"title": "Grow"}]
    payload["industry_benchmarks"] = ["bench"]
    payload["strategic_recommendations"] = [{"title": "Rec"}]
    payload["quick_wins"] = [{"title": "Win"}]
    payload["keyword_topic_opportunities"] = [{"topic": "prog SEO"}]
    payload["audience_fit_opportunities"] = [{"title": "Fit"}]
    payload["channel_playbook"] = [{"channel": "LinkedIn", "recommendations": ["Post"]}]
    payload["pillar_expansion"] = [{"title": "Expand"}]
    result = ins.validate_onboarding_insights(payload)
    assert result["valid"] is True
    assert result["total_fields"] == 10
    assert result["fields_ok"] == 10
    assert result["errors"] == ""


def test_validate_counts_partial_fields():
    payload = {"competitive_positioning": "Leader", "content_gaps": [{"title": "Gap"}]}
    result = ins.validate_onboarding_insights(payload)
    assert result["valid"] is True
    assert result["fields_ok"] == 2


def test_validate_surfaces_type_errors():
    payload = {"competitive_positioning": ["not", "a", "string"]}
    result = ins.validate_onboarding_insights(payload)
    assert result["valid"] is False
    assert result["errors"] != ""


def test_validate_empty_defaults():
    result = ins.validate_onboarding_insights(dict(ins.ONBOARDING_INSIGHTS_DEFAULTS))
    assert result["valid"] is True
    assert result["fields_ok"] == 1  # the "Analysis in progress..." placeholder counts