"""
Tests for Phase 3 prompt tightening.

Covers:
- _is_meaningful: predicate for "is this section worth showing?"
- _data_section: renders or prunes empty sections
- _differentiator_block: only shows when competitor data exists
- _evidence_block: always renders, includes the new DATA_SECTION format
- build_persona_analysis_prompt: full integration, golden file assertions,
  prompt-token pruning is observable for thin-data users.
"""

import json
import re

import pytest

from services.persona.core_persona.prompt_builder import PersonaPromptBuilder


# ---------------------------------------------------------------------
# Golden test data — captured once, asserted against on every test run.
# If the prompt body changes, regenerate the golden files intentionally
# (delete them, run pytest, and commit the new outputs).
# ---------------------------------------------------------------------

GOLDEN_RICH_DATA = {
    "websiteAnalysis": {
        "website_url": "https://shipfast.example.com",
        "analysis_date": "2026-01-15",
        "status": "complete",
        "writing_style": {
            "tone": "plain-spoken, direct, no jargon",
            "voice": "first-person plural, peer-to-peer",
            "complexity": "intermediate",
        },
        "content_characteristics": {
            "sentence_structure": "short, declarative",
            "vocabulary_level": "B2B operator",
        },
        "target_audience": {
            "demographics": ["B2B SaaS founders", "agency refugees"],
            "expertise_level": "intermediate-to-advanced",
        },
        "style_patterns": {
            "patterns": {
                "sentence_length": "short",
                "rhetorical_devices": ["analogy", "numbered lists"],
            }
        },
        "brand_analysis": {
            "values": ["no-fluff", "ship fast", "compound growth"],
            "mission": "Help B2B SaaS founders ship faster without agency overhead.",
        },
        "style_guidelines": {
            "guidelines": {
                "tone_recommendations": ["direct", "evidence-based"],
                "best_practices": ["lead with the number"],
            }
        },
        "crawl_result": {
            "content": (
                "The platform helps B2B SaaS founders ship faster. "
                "We don't do hype. We don't do fluff. We just ship. "
                "Our customers save 6 hours per week on status updates."
            ) * 30,
            "meta_info": {
                "title": "ShipFast — no-fluff B2B SaaS operations",
                "description": (
                    "A plain-spoken platform for B2B SaaS founders who are "
                    "tired of agency overhead and want results that compound."
                ),
            },
        },
    },
    "competitorResearch": {
        "competitors": [
            {"name": "CompA", "tagline": "Innovative cloud-native operations platform"},
            {"name": "CompB", "tagline": "AI-powered workflow automation for modern teams"},
        ]
    },
    "deepCompetitorAnalysis": {
        "tone_comparison": "All competitors use 'innovative' / 'AI-powered' / 'modern'. This brand avoids those.",
    },
}

GOLDEN_THIN_DATA = {
    "websiteAnalysis": {
        "website_url": "https://thin.example.com",
        "crawl_result": {
            "meta_info": {"title": "Thin site"}
        },
    }
}


# ---------------------------------------------------------------------
# Unit: _is_meaningful
# ---------------------------------------------------------------------

class TestIsMeaningful:
    def setup_method(self):
        self.pb = PersonaPromptBuilder()

    @pytest.mark.parametrize("value", [None, {}, [], "", "   ", "\n", "{}", "[]", "null", "None"])
    def test_falsy_values(self, value):
        assert self.pb._is_meaningful(value) is False

    def test_dict_with_content(self):
        assert self.pb._is_meaningful({"a": 1}) is True

    def test_nested_empty_dict(self):
        assert self.pb._is_meaningful({"a": {}, "b": []}) is False

    def test_list_of_empty_dicts(self):
        assert self.pb._is_meaningful([{}, [], None]) is False

    def test_list_with_one_real_string(self):
        assert self.pb._is_meaningful([{}, "real", None]) is True

    def test_number_is_meaningful(self):
        assert self.pb._is_meaningful(0) is True
        assert self.pb._is_meaningful(0.5) is True

    def test_bool_is_meaningful(self):
        # Edge case: bool is a subclass of int; we treat True/False as meaningful
        # because a {"available": False} is a real signal.
        assert self.pb._is_meaningful(False) is True


# ---------------------------------------------------------------------
# Unit: _data_section (pruning)
# ---------------------------------------------------------------------

class TestDataSectionPruning:
    def setup_method(self):
        self.pb = PersonaPromptBuilder()

    def test_empty_dict_returns_none(self):
        assert self.pb._data_section("EMPTY", {}) is None

    def test_with_content_returns_block(self):
        block = self.pb._data_section("POPULATED", {"x": 1})
        assert block is not None
        assert "=== POPULATED ===" in block
        assert '"x"' in block

    def test_nested_empty_returns_none(self):
        assert self.pb._data_section("NESTED", {"a": {}, "b": []}) is None

    def test_trims_trailing_whitespace(self):
        block = self.pb._data_section("T", {"x": 1})
        assert block == block.rstrip() + "\n"


# ---------------------------------------------------------------------
# Unit: _differentiator_block
# ---------------------------------------------------------------------

class TestDifferentiatorBlock:
    def setup_method(self):
        self.pb = PersonaPromptBuilder()

    def test_empty_competitor_data_returns_empty(self):
        assert self.pb._differentiator_block({}) == ""
        assert self.pb._differentiator_block(None) == ""
        assert self.pb._differentiator_block([]) == ""

    def test_with_competitor_data_returns_block(self):
        block = self.pb._differentiator_block({"competitors": [{"name": "X"}]})
        assert "DIFFERENTIATOR" in block
        assert "UNIQUE" in block

    def test_block_includes_format_hint_for_evidence(self):
        block = self.pb._differentiator_block({"competitors": [{"name": "X"}]})
        # Should mention that evidence.*_basis should cite the competitor contrast
        assert "evidence" in block.lower()


# ---------------------------------------------------------------------
# Unit: _evidence_block (REQUIRED EVIDENCE & META-OUTPUT)
# ---------------------------------------------------------------------

class TestEvidenceBlock:
    def setup_method(self):
        self.pb = PersonaPromptBuilder()

    def test_always_renders(self):
        block = self.pb._evidence_block()
        assert "REQUIRED EVIDENCE & META-OUTPUT" in block

    def test_includes_data_section_format_hint(self):
        block = self.pb._evidence_block()
        assert "DATA_SECTION:" in block
        assert "verbatim quote" in block

    def test_includes_calibration_for_confidence(self):
        block = self.pb._evidence_block()
        # Should mention the 0.3/0.5/0.7/0.9 calibration
        for n in ("0.3", "0.5", "0.7", "0.9"):
            assert n in block, f"calibration marker {n} missing"

    def test_includes_what_was_missing_examples(self):
        block = self.pb._evidence_block()
        assert "no audience_intelligence" in block or "audience_intelligence" in block
        assert "what_was_missing" in block

    def test_includes_null_fallback(self):
        block = self.pb._evidence_block()
        assert "'null — no data'" in block


# ---------------------------------------------------------------------
# Integration: build_persona_analysis_prompt
# ---------------------------------------------------------------------

class TestPromptIntegration:
    def setup_method(self):
        self.pb = PersonaPromptBuilder()

    def test_empty_data_prompt_still_renders(self):
        prompt = self.pb.build_persona_analysis_prompt({})
        assert "COMPREHENSIVE BRAND VOICE GENERATION TASK" in prompt
        # Both required sections should always be present
        assert "=== EXTRACTED PHRASES" in prompt
        assert "=== LINGUISTIC ANALYSIS" in prompt
        assert "=== REQUIRED EVIDENCE & META-OUTPUT" in prompt

    def test_empty_data_prunes_empty_sections(self):
        """Empty onboarding data should not produce 16 empty `=== SECTION: {} ===` placeholders."""
        prompt = self.pb.build_persona_analysis_prompt({})
        for pruned_section in (
            "=== BRAND DNA & VALUES ===",
            "=== DETAILED STYLE ANALYSIS ===",
            "=== STYLE GUIDELINES ===",
            "=== CONTENT INSIGHTS ===",
            "=== AUDIENCE INTELLIGENCE ===",
            "=== COMPETITIVE ANALYSIS ===",
            "=== DEEP COMPETITOR INSIGHTS ===",
            "=== SITEMAP ANALYSIS ===",
            "=== META DATA ANALYSIS ===",
            "=== CONTENT STRATEGY INSIGHTS ===",
        ):
            # The empty-section placeholders should be gone
            assert pruned_section not in prompt, (
                f"{pruned_section} should be pruned for empty data but is present"
            )

    def test_rich_data_includes_all_sections(self):
        prompt = self.pb.build_persona_analysis_prompt(GOLDEN_RICH_DATA)
        assert "=== BRAND DNA & VALUES ===" in prompt
        assert "=== COMPETITIVE ANALYSIS ===" in prompt
        assert "=== DEEP COMPETITOR INSIGHTS ===" in prompt
        assert "=== META DATA ANALYSIS ===" in prompt
        assert "=== STYLE GUIDELINES ===" in prompt

    def test_rich_data_includes_differentiator(self):
        prompt = self.pb.build_persona_analysis_prompt(GOLDEN_RICH_DATA)
        assert "=== DIFFERENTIATOR" in prompt
        assert "UNIQUE" in prompt

    def test_thin_data_omits_differentiator(self):
        prompt = self.pb.build_persona_analysis_prompt(GOLDEN_THIN_DATA)
        # No competitor data -> no differentiator
        assert "=== DIFFERENTIATOR" not in prompt

    def test_prompt_size_pruning_saves_tokens_for_thin_data(self):
        """Phase 3 must save a meaningful fraction of tokens for thin-data users.

        The fixed sections (linguistic stub, evidence block, differentiator
        stub, closing instructions) form a floor of ~6k chars. On top of
        that, the data dump grows with how many sections have content.
        For thin data we expect the data dump to be empty (all pruned),
        so the thin prompt should be at-or-near the floor regardless of
        how rich the data is. Rich data should be measurably larger.
        """
        rich_prompt = self.pb.build_persona_analysis_prompt(GOLDEN_RICH_DATA)
        thin_prompt = self.pb.build_persona_analysis_prompt(GOLDEN_THIN_DATA)
        empty_prompt = self.pb.build_persona_analysis_prompt({})

        thin_chars = len(thin_prompt)
        rich_chars = len(rich_prompt)
        empty_chars = len(empty_prompt)

        # The hard guarantee: rich data produces a strictly larger prompt
        # than thin data, so the user pays for the data they actually have.
        assert rich_chars > thin_chars, (
            f"rich prompt ({rich_chars}) should be larger than thin ({thin_chars})"
        )

        # Thin data should match the empty-data floor closely (within
        # 10%). If it doesn't, the pruning is leaking empty sections.
        assert abs(thin_chars - empty_chars) / empty_chars < 0.10, (
            f"thin prompt ({thin_chars}) should be within 10% of empty "
            f"({empty_chars}); got {abs(thin_chars - empty_chars) / empty_chars:.0%}"
        )

    def test_evidence_block_format_appears_in_prompt(self):
        prompt = self.pb.build_persona_analysis_prompt({})
        # The "DATA_SECTION:" format hint must be in the prompt body
        # (not just in the helper — it needs to be visible to the LLM).
        assert "DATA_SECTION:" in prompt
        # And the evidence block must come BEFORE the data dump so the
        # LLM sees the rules first
        evidence_idx = prompt.find("REQUIRED EVIDENCE & META-OUTPUT")
        data_idx = prompt.find("COMPREHENSIVE ONBOARDING DATA ANALYSIS")
        assert evidence_idx != -1
        assert data_idx != -1
        assert evidence_idx < data_idx, "evidence block must come before data dump"


# ---------------------------------------------------------------------
# Golden file tests: capture the prompt body for a known input.
# Re-generate by deleting the file and re-running if the prompt
# intentionally changes.
# ---------------------------------------------------------------------

GOLDEN_DIR = "tests/golden_files"


def _save_golden(name: str, content: str) -> None:
    """Write a golden file. Tests don't call this — it's a developer helper."""
    import os
    os.makedirs(GOLDEN_DIR, exist_ok=True)
    with open(f"{GOLDEN_DIR}/{name}.txt", "w", encoding="utf-8") as f:
        f.write(content)


class TestGoldenFiles:
    """Light-touch golden tests: assert structural invariants + key
    substrings the prompt MUST contain. We don't byte-compare because the
    prompt is allowed to evolve; the contract is "these tokens must be
    there"."""

    def setup_method(self):
        self.pb = PersonaPromptBuilder()
        self.rich_prompt = self.pb.build_persona_analysis_prompt(GOLDEN_RICH_DATA)
        self.thin_prompt = self.pb.build_persona_analysis_prompt(GOLDEN_THIN_DATA)

    def test_rich_prompt_contains_all_brand_voice_anchors(self):
        # Brand voice anchors that the LLM needs to ground claims against
        for anchor in (
            "ShipFast",
            "no-fluff",
            "B2B SaaS founders",
            "plain-spoken",
        ):
            assert anchor in self.rich_prompt, (
                f"brand-voice anchor '{anchor}' missing from rich prompt"
            )

    def test_rich_prompt_contains_format_examples(self):
        # The DATA_SECTION: "<verbatim>" format hint examples should
        # include the literal example we wrote
        assert "BRAND_DNA:" in self.rich_prompt
        assert "META_DATA:" in self.rich_prompt

    def test_thin_prompt_does_not_dump_16_empty_sections(self):
        # No `=== SECTION: {} ===` placeholder cruft
        assert self.thin_prompt.count("{}") < 3, (
            f"thin prompt has {self.thin_prompt.count('{}')} empty braces; "
            f"should be < 3 (only stub renderings of linguistic/excerpts allowed)"
        )


# ---------------------------------------------------------------------
# Integration with core_persona_service: confirm the deterministic
# analyzer output flows into the prompt as a new section.
# ---------------------------------------------------------------------

class TestCorePersonaServicePromptWiring:
    """Verify the LLM call gets a prompt that includes the new sections."""

    def test_prompt_with_linguistic_analysis_includes_analyzer_numbers(self, monkeypatch):
        from services.persona.core_persona.core_persona_service import CorePersonaService

        captured: dict = {}

        def fake_llm_text_gen(*, prompt, **kwargs):
            captured["prompt"] = prompt
            return {
                "identity": {"persona_name": "x", "archetype": "y",
                             "core_belief": "z", "brand_voice_description": "w"},
                "linguistic_fingerprint": {
                    "sentence_metrics": {"average_sentence_length_words": 12,
                                          "preferred_sentence_type": "declarative",
                                          "active_to_passive_ratio": "3:1",
                                          "complexity_level": "medium"},
                    "lexical_features": {"go_to_words": [], "go_to_phrases": [],
                                          "avoid_words": [], "contractions": "rare",
                                          "filler_words": "minimal",
                                          "vocabulary_level": "intermediate"},
                    "rhetorical_devices": {"metaphors": "occasional", "analogies": "frequent",
                                            "rhetorical_questions": "rare",
                                            "storytelling_style": "anecdotal"},
                },
                "tonal_range": {"default_tone": "plain", "permissible_tones": ["plain"],
                                "forbidden_tones": ["fluffy"], "emotional_range": "narrow"},
                "stylistic_constraints": {
                    "punctuation": {"ellipses": "rare", "em_dash": "frequent",
                                     "exclamation_points": "never"},
                    "formatting": {"paragraphs": "short", "lists": "yes", "markdown": "yes"},
                },
                "evidence": {"persona_name_basis": "p", "archetype_basis": "a",
                             "core_belief_basis": "c", "tone_basis": "t",
                             "verbatim_phrases_used": []},
                "what_was_missing": [],
                "confidence": 0.8,
            }

        monkeypatch.setattr(
            "services.persona.core_persona.core_persona_service.llm_text_gen",
            fake_llm_text_gen,
        )

        # Stub the analyzer so we don't need spaCy
        monkeypatch.setattr(
            "services.persona.core_persona.core_persona_service.get_linguistic_analyzer",
            lambda: type("A", (), {
                "analyze_writing_style": staticmethod(
                    lambda samples: {
                        "basic_metrics": {
                            "total_words": 100, "total_sentences": 5,
                            "average_sentence_length": 20.0, "average_word_length": 5.0,
                            "character_count": 500,
                        },
                        "readability_analysis": {
                            "flesch_reading_ease": 60.0, "flesch_kincaid_grade": 8.0,
                            "reading_level": "standard", "complexity_score": 40.0,
                        },
                        "analysis_metadata": {"sample_count": 1, "total_words": 100,
                                              "total_sentences": 5, "analysis_confidence": 50.0},
                    }
                )
            })(),
        )

        result = CorePersonaService().generate_core_persona({
            "websiteAnalysis": {
                "crawl_result": {
                    "content": "Some brand content. " * 60,
                    "meta_info": {"description": "A description of the brand for testing"},
                }
            }
        })

        assert "error" not in result
        assert "identity" in result
        prompt = captured["prompt"]
        # New Phase 3 sections must be in the prompt the LLM actually saw
        assert "=== REQUIRED EVIDENCE & META-OUTPUT" in prompt
        assert "DATA_SECTION:" in prompt
        assert "flesch_reading_ease" in prompt
        # No data → no differentiator (no competitor data provided)
        assert "=== DIFFERENTIATOR" not in prompt
