"""
Smoke test for the new EvidenceAccordion label + gap-count logic.

The frontend TS changes can't be unit-tested with pytest (they live in
TS/React land), but the *logic* — `missingLabel` and the dedup rule
used by `totalGaps` — is portable enough to be validated here as
reference implementations. If the TS diverges from these, the
frontend bugs will resurface.

Run with: pytest tests/test_evidence_accordion_label_logic.py -v
"""

import re


def missing_label(raw: str) -> str:
    """
    Reference implementation of the TS missingLabel() helper.
    Returns the user-facing chip text for a single missing-data entry,
    or "" if the input is unrenderable.
    """
    s = str(raw or "").strip()
    if not s:
        return ""
    s = re.sub(r"^\(reported\)\s+", "", s, flags=re.IGNORECASE)
    if not s:
        return ""
    # Normalize underscores → spaces for every string, sentence or not.
    # Also lowercase the whole thing so "LINGUISTIC_ANALYSIS" doesn't
    # leak into user-facing chips.
    s = s.replace("_", " ")
    s = re.sub(r"\s+", " ", s).strip().lower()
    if not s:
        return ""
    # Sentence form: has whitespace, starts with a letter. The string
    # is already lowercase via the snake→space conversion above, so
    # the sentence branch just needs the prefix logic.
    if s[0].isalpha() and " " in s:
        if re.match(r"^(no |not |missing )", s):
            return s
        return f"we didn't have {s}"
    # Single token (field name, no whitespace).
    return f"we didn't have {s.lower()}"


def dedup_gaps(completeness_missing, llm_missing):
    """
    Reference implementation of the dedup rule used by the badge count
    + the missing-section list. Both sources are merged, normalized, and
    counted once each.
    """
    seen = set()

    def add(raw):
        label = missing_label(str(raw or ""))
        if not label:
            return
        norm = label.lower().strip()
        if norm not in seen:
            seen.add(norm)

    for item in (completeness_missing or []):
        add(item)
    for item in (llm_missing or []):
        add(item)
    return len(seen), [missing_label(str(x)) for x in (completeness_missing or []) if missing_label(str(x))] + \
                       [missing_label(str(x)) for x in (llm_missing or []) if missing_label(str(x)) and missing_label(str(x)) not in [missing_label(str(y)) for y in (completeness_missing or [])]]


# ---------------------------------------------------------------------
# missingLabel
# ---------------------------------------------------------------------

class TestMissingLabel:
    def test_empty_returns_empty(self):
        assert missing_label("") == ""
        assert missing_label("   ") == ""
        assert missing_label(None) == ""

    def test_strips_reported_prefix(self):
        # The "no " prefix is detected, so no double-prefix
        assert missing_label("(reported) no audience_intelligence") == \
            "no audience intelligence"

    def test_reported_prefix_case_insensitive(self):
        # "no " isn't present (LLM wrote "brand_dna was empty" which has
        # no leading "no "), so we add "we didn't have"
        assert missing_label("(REPORTED) brand_dna was empty") == \
            "we didn't have brand dna was empty"

    def test_screaming_snake_case(self):
        # Pure field-name style — normalized to "we didn't have <spaced>"
        assert missing_label("BRAND_VOICE_ANALYSIS") == "we didn't have brand voice analysis"
        assert missing_label("EXTRACTED_PHRASES") == "we didn't have extracted phrases"
        assert missing_label("META_DATA_ANALYSIS") == "we didn't have meta data analysis"

    def test_sentence_passthrough(self):
        # The LLM sometimes writes a free-form sentence
        # ("no " prefix is detected, so no double-prefix; underscores
        # are normalized to spaces)
        assert missing_label("no verbatim phrases found in crawl_result") == \
            "no verbatim phrases found in crawl result"

    def test_sentence_lowercases_first_letter(self):
        out = missing_label("Audience data was empty")
        # 'A' lowered to 'a', "we didn't have " prefix added
        assert out == "we didn't have audience data was empty"

    def test_underscore_to_space(self):
        assert missing_label("LINGUISTIC_ANALYSIS") == "we didn't have linguistic analysis"


# ---------------------------------------------------------------------
# totalGaps dedup (the bug the fix was for)
# ---------------------------------------------------------------------

class TestGapDedup:
    def test_structural_only(self):
        count, _ = dedup_gaps(
            completeness_missing=["linguistic_fingerprint.sentence_metrics",
                                  "stylistic_constraints.punctuation"],
            llm_missing=[],
        )
        assert count == 2

    def test_llm_only(self):
        count, _ = dedup_gaps(
            completeness_missing=[],
            llm_missing=["no verbatim phrases found in crawl_result",
                         "no audience_intelligence"],
        )
        assert count == 2

    def test_overlap_is_deduped(self):
        # The exact bug: backend's compute_completeness copies LLM
        # strings into the structural array with a "(reported) " prefix.
        # Frontend previously counted both, so this would have been 4.
        # After the fix: 2 unique items.
        count, _ = dedup_gaps(
            completeness_missing=[
                "(reported) no verbatim phrases found in crawl_result",
                "(reported) no audience_intelligence",
            ],
            llm_missing=[
                "no verbatim phrases found in crawl_result",
                "no audience_intelligence",
            ],
        )
        assert count == 2, f"expected 2 deduped gaps, got {count}"

    def test_partial_overlap(self):
        count, _ = dedup_gaps(
            completeness_missing=[
                "(reported) no verbatim phrases found in crawl_result",
                "stylistic_constraints.punctuation",
            ],
            llm_missing=[
                "no verbatim phrases found in crawl_result",
            ],
        )
        assert count == 2, f"expected 2 deduped gaps, got {count}"

    def test_case_insensitive_dedup(self):
        count, _ = dedup_gaps(
            completeness_missing=["BRAND_VOICE_ANALYSIS"],
            llm_missing=["brand_voice_analysis"],
        )
        assert count == 1, f"expected 1 deduped gap (case-insensitive), got {count}"

    def test_pasted_real_world_payload(self):
        """Replicate the exact user-pasted output to assert dedup."""
        count, _ = dedup_gaps(
            completeness_missing=[
                "(reported) no verbatim phrases found in crawl_result",
                "(reported) brand_voice_analysis was empty",
                "(reported) deep_competitor_insights was empty",
                "(reported) meta_data_analysis was empty",
                "(reported) content_strategy_insights was empty",
                "(reported) research_preferences was empty",
                # These may also appear in completeness.missing for
                # the user in question (depends on schema sections):
                "linguistic_fingerprint.lexical_features",
                "linguistic_fingerprint.rhetorical_devices",
            ],
            llm_missing=[
                "no verbatim phrases found in crawl_result",
                "brand_voice_analysis was empty",
                "deep_competitor_insights was empty",
                "meta_data_analysis was empty",
                "content_strategy_insights was empty",
                "research_preferences was empty",
            ],
        )
        # 6 LLM-reported (deduped) + 2 structural (unprefixed) = 8
        # Without the fix this would be 6*2 + 2 = 14.
        assert count == 8, f"expected 8 deduped gaps, got {count}"
