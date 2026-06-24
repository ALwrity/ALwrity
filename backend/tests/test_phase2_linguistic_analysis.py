"""
Tests for Phase 2 deterministic linguistic analysis wiring.

Covers:
- OnboardingDataCollector.extract_text_samples_from_onboarding_data
- PersonaPromptBuilder._linguistic_analysis_block
- PersonaPromptBuilder.build_persona_analysis_prompt with linguistic_analysis
- compute_completeness (re-asserts the structural score math is unchanged)
"""

import pytest

from services.persona.core_persona.data_collector import OnboardingDataCollector
from services.persona.core_persona.prompt_builder import PersonaPromptBuilder


class TestExtractTextSamples:
    """OnboardingDataCollector.extract_text_samples_from_onboarding_data"""

    def test_empty_dict_returns_empty_list(self):
        dc = OnboardingDataCollector()
        assert dc.extract_text_samples_from_onboarding_data({}) == []

    def test_none_returns_empty_list(self):
        dc = OnboardingDataCollector()
        assert dc.extract_text_samples_from_onboarding_data(None) == []

    def test_non_dict_returns_empty_list(self):
        dc = OnboardingDataCollector()
        assert dc.extract_text_samples_from_onboarding_data("not a dict") == []
        assert dc.extract_text_samples_from_onboarding_data(42) == []

    def test_min_chars_filter_drops_short_samples(self):
        dc = OnboardingDataCollector()
        data = {
            "websiteAnalysis": {
                "crawl_result": {
                    "meta_info": {"title": "Tiny"}  # 4 chars, under min_chars=200
                }
            }
        }
        assert dc.extract_text_samples_from_onboarding_data(data) == []

    def test_frontend_style_extraction(self):
        dc = OnboardingDataCollector()
        data = {
            "websiteAnalysis": {
                "crawl_result": {
                    "content": "The platform helps B2B SaaS founders ship faster. " * 50,
                    "meta_info": {
                        "title": "ShipFast",
                        "description": "A no-fluff platform for B2B SaaS founders to ship faster and grow MRR without the usual agency overhead."
                    },
                },
            }
        }
        samples = dc.extract_text_samples_from_onboarding_data(data)
        assert len(samples) >= 1
        for s in samples:
            assert len(s) >= 200
            # Dedupe
            assert s == s.strip()

    def test_max_chars_per_sample_caps_long_content(self):
        dc = OnboardingDataCollector()
        long_text = "word " * 5000  # 24995 chars
        data = {"websiteAnalysis": {"crawl_result": {"content": long_text}}}
        samples = dc.extract_text_samples_from_onboarding_data(data, max_chars_per_sample=1000)
        assert len(samples) == 1
        assert len(samples[0]) == 1000

    def test_max_samples_caps_total(self):
        dc = OnboardingDataCollector()
        data = {
            "websiteAnalysis": {
                "crawl_result": {
                    "content": "alpha " * 100,
                    "text": "beta " * 100,
                    "body": "gamma " * 100,
                    "meta_info": {"description": "x" * 300},
                },
                "samples": ["delta " * 100],
                "homepage": ["epsilon " * 100],
            }
        }
        samples = dc.extract_text_samples_from_onboarding_data(data, max_samples=2)
        assert len(samples) == 2

    def test_dedupes_case_insensitive(self):
        dc = OnboardingDataCollector()
        data = {
            "websiteAnalysis": {
                "crawl_result": {
                    "content": "Founders waste 6 hours/week on status updates. " * 30,
                    "meta_info": {"description": "Founders waste 6 hours/week on status updates. Some additional context here for length."},
                }
            }
        }
        samples = dc.extract_text_samples_from_onboarding_data(data)
        keys = [s[:120].lower() for s in samples]
        assert len(keys) == len(set(keys))

    def test_backend_style_extraction(self):
        dc = OnboardingDataCollector()
        # Use long enough text to pass the 200-char min_chars filter.
        long_desc = (
            "A no-fluff voice for B2B SaaS operators who are tired of agency overhead "
            "and want results that compound over time. We write for founders who have "
            "been burned by consultants, who prefer short sentences, who value "
            "specificity over polish, and who would rather hear one concrete number "
            "than three adjectives. We avoid jargon, we avoid hype, and we never use "
            "the word 'synergy' under any circumstances."
        )
        long_tone = (
            "plain-spoken, direct, no jargon, no hyperbole, focused on practical "
            "results for B2B SaaS founders who are time-starved and have been burned "
            "by agencies before. We favor short sentences. We lead with the number, "
            "not the narrative. We treat the reader as a peer who is busy and capable."
        )
        data = {
            "enhanced_analysis": {
                "meta_data": {
                    "title": "Plain-Spoken Voice",
                    "description": long_desc,
                },
                "comprehensive_style_analysis": {
                    "tone_analysis": long_tone,
                }
            }
        }
        samples = dc.extract_text_samples_from_onboarding_data(data)
        assert len(samples) >= 1
        for s in samples:
            assert len(s) >= 200


class TestLinguisticAnalysisBlock:
    """PersonaPromptBuilder._linguistic_analysis_block"""

    def test_none_renders_stub(self):
        block = PersonaPromptBuilder()._linguistic_analysis_block(None)
        assert "=== LINGUISTIC ANALYSIS" in block
        assert "no analyzer output" in block

    def test_error_dict_renders_error_stub(self):
        block = PersonaPromptBuilder()._linguistic_analysis_block({"error": "spaCy crashed"})
        assert "analyzer error: spaCy crashed" in block

    def test_real_data_renders_full_block(self):
        block = PersonaPromptBuilder()._linguistic_analysis_block({
            "basic_metrics": {"total_words": 100, "total_sentences": 5,
                              "average_sentence_length": 20.0, "average_word_length": 5.2,
                              "character_count": 600},
            "sentence_analysis": {
                "sentence_length_distribution": {"min": 10, "avg": 20, "max": 30},
                "sentence_type_distribution": {"declarative": 4, "question": 1},
                "sentence_complexity": {"complex_sentence_ratio": 0.2,
                                        "compound_sentence_ratio": 0.4},
            },
            "vocabulary_analysis": {
                "lexical_diversity": 0.5, "vocabulary_size": 50,
                "word_length_distribution": {"short": 30, "medium": 50, "long": 20},
                "vocabulary_sophistication": {"sophistication_score": 40.0},
            },
            "readability_analysis": {
                "flesch_reading_ease": 60.0, "flesch_kincaid_grade": 8.0,
                "reading_level": "standard", "complexity_score": 50.0,
            },
            "emotional_analysis": {"sentiment_bias": "neutral", "emotional_intensity": 5.0},
            "consistency_analysis": {"consistency_score": 75.0},
            "analysis_metadata": {"sample_count": 1, "total_words": 100,
                                  "total_sentences": 5, "analysis_confidence": 50.0},
        })
        assert "=== LINGUISTIC ANALYSIS" in block
        assert "flesch_reading_ease" in block
        assert "60.0" in block
        assert "Use them to ground" in block


class TestPromptIncludesLinguisticBlock:
    """build_persona_analysis_prompt should always include the linguistic block."""

    def test_block_present_when_analysis_provided(self):
        prompt = PersonaPromptBuilder().build_persona_analysis_prompt(
            {},
            linguistic_analysis={
                "basic_metrics": {"total_words": 10, "total_sentences": 1,
                                  "average_sentence_length": 10.0,
                                  "average_word_length": 4.0, "character_count": 50},
                "readability_analysis": {"flesch_reading_ease": 70.0,
                                          "flesch_kincaid_grade": 7.0,
                                          "reading_level": "standard",
                                          "complexity_score": 40.0},
            }
        )
        assert "=== LINGUISTIC ANALYSIS" in prompt
        assert "flesch_reading_ease" in prompt

    def test_block_present_when_analysis_missing(self):
        prompt = PersonaPromptBuilder().build_persona_analysis_prompt({})
        assert "=== LINGUISTIC ANALYSIS" in prompt
        assert "no analyzer output" in prompt

    def test_default_param_still_works_for_existing_callers(self):
        # Backward compat: callers that don't pass linguistic_analysis still work.
        prompt = PersonaPromptBuilder().build_persona_analysis_prompt({})
        assert "COMPREHENSIVE BRAND VOICE GENERATION TASK" in prompt


class TestComputeCompletenessStillWorks:
    """compute_completeness unchanged from Phase 1 (regression check)."""

    def test_full_persona_scores_high(self):
        persona = {
            "identity": {"persona_name": "X", "archetype": "Y", "core_belief": "Z", "brand_voice_description": "W"},
            "linguistic_fingerprint": {
                "sentence_metrics": {"average_sentence_length_words": 15},
                "lexical_features": {"go_to_words": ["a"], "go_to_phrases": ["b"], "avoid_words": ["c"]},
                "rhetorical_devices": {"metaphors": "yes"},
            },
            "tonal_range": {"default_tone": "plain", "permissible_tones": ["a"],
                            "forbidden_tones": ["b"], "emotional_range": "narrow"},
            "stylistic_constraints": {
                "punctuation": {"ellipses": "rare", "em_dash": "frequent", "exclamation_points": "never"},
                "formatting": {"paragraphs": "short", "lists": "yes", "markdown": "yes"},
            },
            "evidence": {"persona_name_basis": "p", "archetype_basis": "a", "core_belief_basis": "c",
                         "tone_basis": "t", "verbatim_phrases_used": []},
            "what_was_missing": [],
            "confidence": 0.9,
        }
        c = PersonaPromptBuilder().compute_completeness(persona)
        # structural_score should be 1.0; final capped by confidence=0.9
        assert c["structural_score"] == 1.0
        assert c["score"] == 0.9
        assert c["missing"] == []
