"""
Persona Prompt Builder

Handles building comprehensive prompts for persona generation.
"""

from typing import Dict, Any, List, Optional
import json
from loguru import logger


class PersonaPromptBuilder:
    """Builds comprehensive prompts for persona generation."""

    def _prune_for_prompt(
        self,
        value: Any,
        *,
        max_depth: int = 4,
        max_list_items: int = 24,
        max_dict_items: int = 60,
        max_str_len: int = 1800,
        _depth: int = 0,
    ) -> Any:
        if _depth >= max_depth:
            if isinstance(value, (dict, list)):
                return {"_truncated": True}
            if isinstance(value, str) and len(value) > max_str_len:
                return value[:max_str_len] + "…"
            return value

        if isinstance(value, dict):
            pruned: Dict[str, Any] = {}
            for i, (k, v) in enumerate(value.items()):
                if i >= max_dict_items:
                    pruned["_truncated_keys"] = True
                    break
                pruned[k] = self._prune_for_prompt(
                    v,
                    max_depth=max_depth,
                    max_list_items=max_list_items,
                    max_dict_items=max_dict_items,
                    max_str_len=max_str_len,
                    _depth=_depth + 1,
                )
            return pruned

        if isinstance(value, list):
            pruned_list = []
            for i, item in enumerate(value[:max_list_items]):
                pruned_list.append(
                    self._prune_for_prompt(
                        item,
                        max_depth=max_depth,
                        max_list_items=max_list_items,
                        max_dict_items=max_dict_items,
                        max_str_len=max_str_len,
                        _depth=_depth + 1,
                    )
                )
            if len(value) > max_list_items:
                pruned_list.append({"_truncated_items": True})
            return pruned_list

        if isinstance(value, str) and len(value) > max_str_len:
            return value[:max_str_len] + "…"

        return value

    def _json_for_prompt(self, value: Any) -> str:
        try:
            return json.dumps(self._prune_for_prompt(value), indent=2, ensure_ascii=False)
        except Exception:
            return json.dumps({"_error": "Failed to serialize"}, indent=2)

    # ------------------------------------------------------------------
    # Verbatim-phrase extraction
    # ------------------------------------------------------------------
    # Many personas drift into generic archetypes because the LLM never
    # sees the *brand's own words*. This helper pulls 3-5 actual short
    # phrases from the crawled website content and surfaces them in the
    # prompt, so the LLM can ground go_to_phrases in the brand's own
    # vocabulary. Result: a more specific, more "this brand" persona.
    # ------------------------------------------------------------------
    _PHRASE_MIN_LEN = 18
    _PHRASE_MAX_LEN = 90
    _PHRASE_COUNT   = 5
    # Words that look "branded" but are too generic to be useful as
    # verbatim evidence. Used only for filtering candidates.
    _PHRASE_STOPWORDS = {
        "home", "click", "here", "read", "more", "learn", "about",
        "contact", "submit", "login", "logout", "menu", "search",
        "copyright", "rights", "reserved", "privacy", "policy", "terms",
        "service", "services", "products", "product", "company",
        "homepage", "page", "website", "site", "blog", "post",
    }

    def _candidate_texts(self, onboarding_data: Dict[str, Any]) -> List[str]:
        """Return a list of strings to search for verbatim phrases.

        Pulls from the website crawl result, headings, and meta description.
        """
        candidates: List[str] = []

        wa = onboarding_data.get("websiteAnalysis") or {}
        # Frontend-style data
        crawl = wa.get("crawl_result") or {}
        meta_info = wa.get("meta_info") or crawl.get("meta_info") or {}
        if isinstance(meta_info, dict):
            for k in ("title", "description", "og_description", "twitter_description"):
                v = meta_info.get(k)
                if isinstance(v, str) and v.strip():
                    candidates.append(v.strip())
            h1 = meta_info.get("h1") or meta_info.get("headings") or []
            if isinstance(h1, list):
                candidates.extend([str(x).strip() for x in h1 if x])
            elif isinstance(h1, str):
                candidates.append(h1.strip())

        # Backend-style data: enhanced_analysis.meta_data and crawl_result
        ea = onboarding_data.get("enhanced_analysis") or {}
        meta_ea = ea.get("meta_data") or {}
        if isinstance(meta_ea, dict):
            for k in ("title", "description", "headlines", "h1", "h2"):
                v = meta_ea.get(k)
                if isinstance(v, str) and v.strip():
                    candidates.append(v.strip())
                elif isinstance(v, list):
                    candidates.extend([str(x).strip() for x in v if x])

        # Crawled content excerpts (try multiple known locations)
        for path in [
            ("content",),
            ("crawl_result", "content"),
            ("crawl_result", "text"),
            ("crawl_result", "body"),
            ("samples",),
            ("homepage",),
        ]:
            node: Any = wa
            for key in path:
                if isinstance(node, dict):
                    node = node.get(key)
                else:
                    node = None
                    break
            if isinstance(node, str) and node.strip():
                candidates.append(node.strip())
            elif isinstance(node, list):
                candidates.extend([str(x).strip() for x in node if x])

        # De-dup
        seen = set()
        out: List[str] = []
        for c in candidates:
            key = c.lower()[:120]
            if key in seen:
                continue
            seen.add(key)
            out.append(c)
        return out

    def _extract_verbatim_phrases(self, onboarding_data: Dict[str, Any]) -> List[str]:
        """Return up to N verbatim short phrases from the brand's own content.

        These are surface-level evidence — short, distinctive strings that
        a reader would recognize as belonging to this specific brand. The
        LLM uses them to ground `go_to_phrases` and `evidence.verbatim_phrases_used`.
        """
        import re

        candidates = self._candidate_texts(onboarding_data)
        if not candidates:
            return []

        # Heuristic scoring: prefer phrases with brand-like words
        # (proper nouns, hyphens, distinctive adjectives). De-prioritize
        # generic stopwords.
        candidates.sort(key=len)  # Prefer shorter snippets

        phrase_re = re.compile(r"[A-Za-z][A-Za-z0-9'\-\.,!?&\s]{%d,%d}" % (
            self._PHRASE_MIN_LEN - 1, self._PHRASE_MAX_LEN - 1
        ))

        scored: List[tuple] = []
        for text in candidates[:8]:  # don't process a million candidates
            for match in phrase_re.findall(text):
                cleaned = " ".join(match.split())
                low = cleaned.lower()
                if any(sw in low.split() for sw in self._PHRASE_STOPWORDS):
                    continue
                # Heuristic: capitalised words or hyphens = brand-like
                score = 0
                if any(w[:1].isupper() and len(w) > 2 for w in cleaned.split()):
                    score += 2
                if "-" in cleaned:
                    score += 1
                if any(c.isdigit() for c in cleaned):
                    score += 1
                score += min(len(cleaned.split()), 8)  # prefer 3-8 words
                scored.append((score, cleaned))

        # Dedupe (case-insensitive) and keep top N
        scored.sort(key=lambda x: (-x[0], x[1]))
        seen: set = set()
        out: List[str] = []
        for _, phrase in scored:
            key = phrase.lower()
            if key in seen:
                continue
            seen.add(key)
            out.append(phrase)
            if len(out) >= self._PHRASE_COUNT:
                break
        return out

    def _phrases_block(self, phrases: List[str]) -> str:
        """Render the EXTRACTED PHRASES section for the prompt."""
        if not phrases:
            return (
                "=== EXTRACTED PHRASES FROM BRAND CONTENT ===\n"
                "(none — crawl content was unavailable. Persona must reflect this by "
                "grounding claims in Brand DNA, Style Analysis, or Audience data instead.)\n"
            )
        lines = ["=== EXTRACTED PHRASES FROM BRAND CONTENT (verbatim, from the brand's own website) ==="]
        for i, p in enumerate(phrases, 1):
            lines.append(f'{i}. "{p}"')
        lines.append("")
        lines.append("Use these phrases (when relevant) to ground `go_to_phrases` and `evidence.verbatim_phrases_used` in the actual brand voice.")
        return "\n".join(lines)

    def _linguistic_analysis_block(self, linguistic_analysis: Optional[Dict[str, Any]]) -> str:
        """Render the LINGUISTIC ANALYSIS (deterministic) section for the prompt.

        These are *measured* numbers, not LLM estimates. The LLM should
        use them to ground claims in `linguistic_fingerprint` — e.g. if
        the analyzer says `average_sentence_length: 18.4`, the persona's
        `sentence_metrics.average_sentence_length_words` should be ~18,
        not a generic 15 or 20.
        """
        if not linguistic_analysis or not isinstance(linguistic_analysis, dict):
            return (
                "=== LINGUISTIC ANALYSIS (deterministic) ===\n"
                "(no analyzer output — fall back to soft-mock or infer from LINGUISTIC STYLE ANALYSIS below)\n"
            )
        if "error" in linguistic_analysis:
            return (
                f"=== LINGUISTIC ANALYSIS (deterministic) ===\n"
                f"(analyzer error: {linguistic_analysis.get('error')}. "
                f"Fall back to soft-mock or infer from LINGUISTIC STYLE ANALYSIS below.)\n"
            )

        # Pull the sub-analyses we care about. Each is independent so
        # partial analyzer output still produces a useful section.
        bm  = linguistic_analysis.get("basic_metrics", {}) or {}
        sa  = linguistic_analysis.get("sentence_analysis", {}) or {}
        va  = linguistic_analysis.get("vocabulary_analysis", {}) or {}
        ra  = linguistic_analysis.get("readability_analysis", {}) or {}
        ea  = linguistic_analysis.get("emotional_analysis", {}) or {}
        ca  = linguistic_analysis.get("consistency_analysis", {}) or {}
        meta = linguistic_analysis.get("analysis_metadata", {}) or {}

        sld = sa.get("sentence_length_distribution", {}) or {}
        std_ = sa.get("sentence_type_distribution", {}) or {}
        cs  = sa.get("sentence_complexity", {}) or {}
        wd  = va.get("word_length_distribution", {}) or {}
        vs  = va.get("vocabulary_sophistication", {}) or {}

        lines = [
            "=== LINGUISTIC ANALYSIS (deterministic, computed from the brand's own content) ===",
            "These numbers were MEASURED by a deterministic analyzer (spaCy + NLTK + textstat), "
            "not estimated by an LLM. Use them to ground the persona's `linguistic_fingerprint` "
            "in real measurements — round to the nearest sensible value, do NOT invent different ones.",
            "",
            f"Sample size: {meta.get('sample_count', '?')} sample(s), {bm.get('total_words', '?')} words, {bm.get('total_sentences', '?')} sentences",
            f"Analysis confidence: {meta.get('analysis_confidence', '?')}%",
            "",
            f"Basic metrics:",
            f"  - average_sentence_length_words: {bm.get('average_sentence_length', '?')}",
            f"  - average_word_length_chars:     {bm.get('average_word_length', '?')}",
            f"  - character_count:               {bm.get('character_count', '?')}",
            "",
            f"Sentence analysis:",
            f"  - sentence length min/avg/max: {sld.get('min', '?')} / {sld.get('average', '?')} / {sld.get('max', '?')}",
            f"  - sentence type mix:           {std_ or '?'}",
            f"  - complex_sentence_ratio:      {cs.get('complex_sentence_ratio', '?')}",
            f"  - compound_sentence_ratio:     {cs.get('compound_sentence_ratio', '?')}",
            "",
            f"Vocabulary:",
            f"  - lexical_diversity:           {va.get('lexical_diversity', '?')}",
            f"  - vocabulary_size:            {va.get('vocabulary_size', '?')}",
            f"  - long/medium/short word mix: {wd or '?'}",
            f"  - sophistication_score:       {vs.get('sophistication_score', '?')}",
            "",
            f"Readability:",
            f"  - flesch_reading_ease:        {ra.get('flesch_reading_ease', '?')}",
            f"  - flesch_kincaid_grade:       {ra.get('flesch_kincaid_grade', '?')}",
            f"  - reading_level:              {ra.get('reading_level', '?')}",
            f"  - complexity_score:           {ra.get('complexity_score', '?')}",
            "",
            f"Emotional tone:",
            f"  - sentiment_bias:             {ea.get('sentiment_bias', '?')}",
            f"  - emotional_intensity:        {ea.get('emotional_intensity', '?')}%",
            "",
            f"Style consistency: {ca.get('consistency_score', '?')}%",
            "",
            "INSTRUCTIONS:",
            "- `linguistic_fingerprint.sentence_metrics.average_sentence_length_words` must reflect the measured value above (rounded to nearest integer if needed).",
            "- `linguistic_fingerprint.sentence_metrics.complexity_level` must reflect the measured `complexity_score` and `complex_sentence_ratio`.",
            "- `linguistic_fingerprint.rhetorical_devices` should be derived from the actual sentence structure / patterns measured, not generic defaults.",
            "- If the analyzer data contradicts a softer signal in the brand data, prefer the analyzer data for *numerical* claims (e.g. sentence length) and the brand data for *narrative* claims (e.g. tone, archetype).",
            "- Note in `evidence.*_basis` whenever a number was sourced from this deterministic section.",
        ]
        return "\n".join(lines)

    def _is_meaningful(self, value: Any) -> bool:
        """Phase 3: predicate used to decide if a prompt section has enough
        content to render. Returns False for None, empty containers, and
        trivially-empty serialized values. Lets the prompt-builder drop
        noisy `=== SECTION: {} ===` placeholders when the data is thin.
        """
        if value is None:
            return False
        if isinstance(value, str):
            return bool(value.strip()) and value.strip() not in {"{}", "[]", "null", "None"}
        if isinstance(value, (list, tuple, set)):
            return any(self._is_meaningful(v) for v in value)
        if isinstance(value, dict):
            return any(self._is_meaningful(v) for v in value.values())
        return True

    def _render_section(self, title: str, body: str) -> str:
        """Render a single `=== TITLE ===\\nBODY` block. Phase 3 uses this
        in a list-of-sections pattern so we can prune empty sections
        before assembling the final prompt.
        """
        return f"=== {title} ===\n{body.rstrip()}\n"

    def _data_section(self, title: str, value: Any) -> Optional[str]:
        """Render a `=== TITLE ===\\n<json>` data section, or return None
        if the data is empty / meaningless. Phase 3 uses this to drop
        empty sections that would otherwise just be `{}` and waste LLM
        attention budget.
        """
        if not self._is_meaningful(value):
            return None
        return self._render_section(title, self._json_for_prompt(value))

    def _differentiator_block(self, competitor_data: Any) -> str:
        """Phase 3: render the DIFFERENTIATOR section.

        Forces the LLM to compare the brand against its competitors and
        surface what is UNIQUE. Without this, the LLM drifts into generic
        claims like "you write clearly" instead of "you're the only B2B
        SaaS blog that uses sports metaphors".

        Returns the section text. Caller decides whether to include it
        based on whether competitor data exists.
        """
        if not self._is_meaningful(competitor_data):
            return ""
        return self._render_section(
            "DIFFERENTIATOR (what makes this brand UNIQUE vs competitors)",
            (
                "Compare THIS brand against the COMPETITIVE ANALYSIS / "
                "DEEP COMPETITOR INSIGHTS sections above. Then in your "
                "persona, surface at least 2 things that are UNIQUELY this "
                "brand's — not generic to its category. Examples of good "
                "differentiator signals: a recurring metaphor competitors "
                "don't use, a sentence structure pattern competitors avoid, "
                "a specific phrase in the homepage that none of the "
                "competitors have, a topic competitors never cover.\n\n"
                "In `evidence.archetype_basis` and `evidence.tone_basis`, "
                "explicitly cite which competitor contrast led to your "
                "claim (e.g. 'archetype_basis: DIFFERS FROM COMPETITORS — "
                "competitors in COMPETITIVE ANALYSIS all use the term "
                "\\'innovative\\' but this brand\\'s META DATA uses "
                "\\'plain-spoken\\'')."
            ),
        )

    def _evidence_block(self) -> str:
        """Phase 3: render the REQUIRED EVIDENCE & META-OUTPUT section.

        Each required schema field gets its own sub-block with explicit
        input data the LLM should look at. This is the single biggest
        upgrade in Phase 3: the LLM is now told, for every required
        output field, which data sections to consult.
        """
        return self._render_section(
            "REQUIRED EVIDENCE & META-OUTPUT (every field below is REQUIRED)",
            (
                "These fields are validated downstream. The persona will be "
                "rejected if any of them is missing or generic.\n\n"
                "evidence.persona_name_basis\n"
                "  FORMAT: 'DATA_SECTION: \"<5-15 word verbatim quote>\"'\n"
                "  EXAMPLE: 'BRAND_DNA: \"we don\\'t do hype\"'\n"
                "  EXAMPLE: 'META_DATA: \"plain-spoken voice for B2B SaaS\"'\n"
                "  If no good basis exists, write exactly: 'null — no data'\n\n"
                "evidence.archetype_basis\n"
                "  FORMAT: 'DATA_SECTION: \"<5-15 word verbatim quote>\"'\n"
                "  Cite COMPETITIVE ANALYSIS / DEEP COMPETITOR INSIGHTS if "
                "the archetype is grounded in differentiation from peers.\n"
                "  If no good basis exists, write exactly: 'null — no data'\n\n"
                "evidence.core_belief_basis\n"
                "  FORMAT: 'DATA_SECTION: \"<5-15 word verbatim quote>\"'\n"
                "  Most often sourced from BRAND_DNA, STYLE_GUIDELINES, or "
                "the homepage copy in META_DATA.\n"
                "  If no good basis exists, write exactly: 'null — no data'\n\n"
                "evidence.tone_basis\n"
                "  FORMAT: 'DATA_SECTION: \"<5-15 word verbatim quote>\"'\n"
                "  Most often sourced from DETAILED STYLE ANALYSIS or "
                "COMPREHENSIVE STYLE ANALYSIS.\n"
                "  If no good basis exists, write exactly: 'null — no data'\n\n"
                "evidence.verbatim_phrases_used\n"
                "  FORMAT: list of exact strings lifted from the EXTRACTED "
                "PHRASES section of this prompt. Quote them verbatim — do "
                "not paraphrase. If no good phrases were extracted, return []\n\n"
                "what_was_missing\n"
                "  FORMAT: list of short strings naming empty data sections.\n"
                "  EXAMPLES: 'no audience_intelligence', 'competitor_research "
                "was empty', 'no verbatim phrases found in crawl_result', "
                "'LINGUISTIC ANALYSIS (deterministic) had no analyzer output'\n"
                "  If everything was present, return [].\n\n"
                "confidence (0.0-1.0)\n"
                "  FORMAT: a single number.\n"
                "  CALIBRATION GUIDE: 0.3 if 0-25% of data sections populated, "
                "0.5 if 25-50%, 0.7 if 50-75%, 0.9 if 75-100% AND the brand "
                "DNA + style guidelines + verbatim phrases are all present.\n"
                "  This is shown to the user as a 'X% confident' badge — be "
                "honest, not flattering."
            ),
        )

    def build_persona_analysis_prompt(
        self,
        onboarding_data: Dict[str, Any],
        *,
        linguistic_analysis: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Build the main brand voice analysis prompt with comprehensive data.

        When ``linguistic_analysis`` is provided (a dict from
        ``EnhancedLinguisticAnalyzer.analyze_writing_style``), the prompt
        includes a deterministic-measurements section that grounds
        ``linguistic_fingerprint`` in real numbers. When ``None`` (e.g.
        analyzer errored, no crawl content, or soft-mock fallback), the
        section is rendered as a "(no analyzer output)" stub so the LLM
        knows to rely on other signals.

        Phase 3 changes (additive — backward compatible with the
        pre-Phase-3 contract):
          * Prune empty data sections instead of emitting `=== SECTION:
            {} ===`. Saves ~30% of prompt tokens for thin-data users.
          * Add `DIFFERENTIATOR` section that frames archetype + tone in
            terms of *what's unique vs competitors*.
          * Add `REQUIRED EVIDENCE & META-OUTPUT` section that gives
            every required schema field its own sub-block with explicit
            format and citation rules.
          * Tighten the closing requirements to reference the new
            sections instead of restating them.
        """

        # Handle both frontend-style data and backend database-style data
        # Frontend sends: {websiteAnalysis, competitorResearch, sitemapAnalysis, businessData}
        # Backend sends: {enhanced_analysis, website_analysis, research_preferences}

        # Normalize data structure
        if "websiteAnalysis" in onboarding_data:
            # Frontend-style data - adapt to expected structure
            website_analysis = onboarding_data.get("websiteAnalysis", {}) or {}
            competitor_research = onboarding_data.get("competitorResearch", {}) or {}
            sitemap_analysis = onboarding_data.get("sitemapAnalysis", {}) or {}
            business_data = onboarding_data.get("businessData", {}) or {}
            research_preferences = onboarding_data.get("researchPreferences", {}) or {}
            deep_competitor_analysis = onboarding_data.get("deepCompetitorAnalysis", {}) or {}

            crawl_result = website_analysis.get("crawl_result", {}) or {}
            meta_info = website_analysis.get("meta_info") or crawl_result.get("meta_info") or {}

            # Create enhanced_analysis from frontend data
            enhanced_analysis = {
                "comprehensive_style_analysis": website_analysis.get("writing_style", {}),
                "content_insights": website_analysis.get("content_characteristics", {}),
                "audience_intelligence": website_analysis.get("target_audience", {}),
                "technical_writing_metrics": website_analysis.get("style_patterns", {}),
                "brand_dna": website_analysis.get("brand_analysis", {}),
                "style_guidelines": website_analysis.get("style_guidelines", {}),
                "social_media_presence": website_analysis.get("social_media_presence", {}),
                "competitive_analysis": competitor_research,
                "deep_competitor_analysis": deep_competitor_analysis,
                "sitemap_analysis": sitemap_analysis,
                "meta_data": meta_info,
                "research_preferences": research_preferences,
                "business_context": business_data
            }
            research_prefs = {}
        else:
            # Backend database-style data
            enhanced_analysis = onboarding_data.get("enhanced_analysis", {})
            website_analysis = onboarding_data.get("website_analysis", {}) or {}
            # Ensure Brand DNA and Guidelines are present if available in website_analysis but not enhanced_analysis
            if "brand_dna" not in enhanced_analysis:
                enhanced_analysis["brand_dna"] = website_analysis.get("brand_analysis", {})
            if "style_guidelines" not in enhanced_analysis:
                enhanced_analysis["style_guidelines"] = website_analysis.get("style_guidelines", {})
            if "social_media_presence" not in enhanced_analysis:
                enhanced_analysis["social_media_presence"] = website_analysis.get("social_media_presence", {})

            research_prefs = onboarding_data.get("research_preferences", {}) or {}

        # Extract verbatim phrases from the brand's own content. These
        # surface the brand's actual vocabulary in the prompt so the LLM
        # can ground `go_to_phrases` and the `evidence` field in the
        # brand's real voice — not a generic archetype.
        verbatim_phrases = self._extract_verbatim_phrases(onboarding_data)
        phrases_block = self._phrases_block(verbatim_phrases)

        # Phase 2: render the deterministic linguistic analysis block
        # (computed from the brand's own content). Always included so the
        # LLM knows whether the numbers exist or not.
        linguistic_block = self._linguistic_analysis_block(linguistic_analysis)

        # Phase 3: build the data dump as a list of (title, body) tuples
        # and prune empty sections in one pass. The previous prompt
        # emitted 16 sections unconditionally even when most were `{}`,
        # which wasted LLM attention budget.
        overview_body = (
            f"WEBSITE ANALYSIS OVERVIEW:\n"
            f"- URL: {website_analysis.get('website_url', 'Not provided')}\n"
            f"- Analysis Date: {website_analysis.get('analysis_date', 'Not provided')}\n"
            f"- Status: {website_analysis.get('status', 'Not provided')}"
        )

        data_sections: List[Optional[str]] = [
            self._data_section("BRAND DNA & VALUES", enhanced_analysis.get("brand_dna", {})),
            self._data_section("DETAILED STYLE ANALYSIS", enhanced_analysis.get("comprehensive_style_analysis", {})),
            self._data_section("STYLE GUIDELINES", enhanced_analysis.get("style_guidelines", {})),
            self._data_section("CONTENT INSIGHTS", enhanced_analysis.get("content_insights", {})),
            self._data_section("AUDIENCE INTELLIGENCE", enhanced_analysis.get("audience_intelligence", {})),
            self._data_section("SOCIAL MEDIA PRESENCE", enhanced_analysis.get("social_media_presence", {})),
            self._data_section("BRAND VOICE ANALYSIS", enhanced_analysis.get("brand_voice_analysis", {})),
            self._data_section("TECHNICAL WRITING METRICS", enhanced_analysis.get("technical_writing_metrics", {})),
            self._data_section("COMPETITIVE ANALYSIS", enhanced_analysis.get("competitive_analysis", {})),
            self._data_section("DEEP COMPETITOR INSIGHTS", enhanced_analysis.get("deep_competitor_analysis", {})),
            self._data_section(
                "SITEMAP ANALYSIS",
                enhanced_analysis.get("sitemap_analysis", {}) or enhanced_analysis.get("sitemap_data", {}),
            ),
            self._data_section("META DATA ANALYSIS", enhanced_analysis.get("meta_data", {})),
            self._data_section("CONTENT STRATEGY INSIGHTS", enhanced_analysis.get("content_strategy_insights", {})),
            self._data_section("RESEARCH PREFERENCES", enhanced_analysis.get("research_preferences", {})),
            self._data_section("BUSINESS CONTEXT", enhanced_analysis.get("business_context", {})),
            self._data_section(
                "LEGACY FIELDS (minimal; use if needed)",
                {
                    "writing_style": website_analysis.get("writing_style", {}),
                    "content_characteristics": website_analysis.get("content_characteristics", {}) or {},
                    "target_audience": website_analysis.get("target_audience", {}),
                    "style_patterns": website_analysis.get("style_patterns", {}),
                },
            ),
        ]
        data_sections_text = "\n\n".join(s for s in data_sections if s)

        # Phase 3: competitor differentiator — only included when there's
        # actually competitor data to compare against. Falls back gracefully.
        competitor_blob = enhanced_analysis.get("competitive_analysis", {}) or enhanced_analysis.get("deep_competitor_analysis", {})
        differentiator_block = self._differentiator_block(competitor_blob)

        # Phase 3: REQUIRED EVIDENCE & META-OUTPUT — always included.
        evidence_block = self._evidence_block()

        prompt = f"""
COMPREHENSIVE BRAND VOICE GENERATION TASK: Create a highly detailed, data-driven Brand Writing Style and Identity based on extensive AI analysis of user's website and content strategy.

{phrases_block}

{linguistic_block}

{evidence_block}

{differentiator_block}

=== COMPREHENSIVE ONBOARDING DATA ANALYSIS ===

{overview_body}

{data_sections_text}

=== COMPREHENSIVE BRAND IDENTITY GENERATION REQUIREMENTS ===

1. BRAND IDENTITY (must be SPECIFIC — never generic):
   - persona_name: A specific, memorable name. Examples: "The Plain-Spoken Operator", "The Curious Cartographer", "The Reluctant Marketer". NOT generic like "The Expert" or "The Thought Leader" unless the data explicitly supports that exact framing.
   - archetype: A specific role, not a category. Examples: "No-fluff operator for B2B SaaS founders", "Mid-career researcher translating dense topics for general readers". NOT generic like "industry professional" or "thought leader".
   - core_belief: 1-2 sentences. Grounded in the data — what does the brand actually believe that drives how they write?
   - brand_voice_description: 2-3 sentences describing how the voice sounds, in concrete terms.

2. LINGUISTIC FINGERPRINT (grounded in Technical Metrics, not invented):
   - Use the EXTRACTED PHRASES above to populate go_to_phrases. Do not invent phrases.
   - go_to_words: prefer the actual words that appear in the brand's content over generic vocabulary lists.
   - Calculate average_sentence_length_words, active_to_passive_ratio, complexity_level from the data — do not guess.
   - If the LINGUISTIC ANALYSIS (deterministic) section above has real numbers, anchor on those — they are measured, not estimated.

3. TONAL RANGE (from Comprehensive Style Analysis):
   - default_tone must come from the data, not a generic default.
   - If the data is thin on tone, set default_tone to "data-thin — please provide more inputs" rather than guessing.

4. EVIDENCE, META-OUTPUT, AND CONFIDENCE (REQUIRED):
   - See the `REQUIRED EVIDENCE & META-OUTPUT` section near the top of this prompt for the exact format, examples, and calibration rules.
   - Every `evidence.*_basis` field MUST be in the `DATA_SECTION: "<verbatim quote>"` format. Free-form prose is rejected.
   - `what_was_missing` MUST be a non-empty list if any data section was empty; otherwise `[]`.
   - `confidence` MUST be a single number, calibrated to actual data richness, not aspirational.

5. DIFFERENTIATION (REQUIRED when competitors data exists):
   - See the `DIFFERENTIATOR` section above. Cite the competitor contrast in `evidence.*_basis`.

=== ENHANCED ANALYSIS INSTRUCTIONS ===
- Use the EXTRACTED PHRASES from the brand's own content to ground go_to_phrases and evidence.verbatim_phrases_used.
- Use the LINGUISTIC ANALYSIS (deterministic) section to ground `linguistic_fingerprint` numerical claims in measured reality — sentence length, complexity, vocabulary, readability. If the analyzer data is missing, fall back to the LINGUISTIC STYLE ANALYSIS / TECHNICAL WRITING METRICS sections and note this in `evidence.*_basis`.
- Use the DIFFERENTIATOR section (when present) to make the persona UNIQUE rather than generic to its category.
- The `evidence` field is REQUIRED and must cite specific data sections in the prescribed `DATA_SECTION: "<verbatim quote>"` format.
- The `what_was_missing` field is REQUIRED and must honestly list data gaps.
- The `confidence` field is REQUIRED and must be calibrated to actual data richness, not aspirational.
- Avoid generic archetypes, generic go_to_words ("innovative", "cutting-edge"), and generic tones ("professional yet approachable") unless the data explicitly supports them.
- Lean into specifics — brand name, unique phrases, exact meta description, sitemap structure.

Generate a brand voice that is SO specific to this user that no other brand could use it. A third-party reader should immediately recognize content written from this persona as belonging to this specific brand.
"""

        return prompt
    
    def build_platform_adaptation_prompt(self, core_persona: Dict[str, Any], platform: str, onboarding_data: Dict[str, Any], platform_constraints: Dict[str, Any]) -> str:
        """Build prompt for platform-specific persona adaptation."""
        
        prompt = f"""
PLATFORM ADAPTATION TASK: Adapt the core writing persona for {platform.upper()}.

CORE PERSONA:
{json.dumps(core_persona, indent=2)}

PLATFORM: {platform.upper()}

PLATFORM CONSTRAINTS:
{json.dumps(platform_constraints, indent=2)}

ADAPTATION REQUIREMENTS:

1. SENTENCE METRICS:
   - Adjust sentence length for platform optimal performance
   - Adapt sentence variety for platform engagement
   - Consider platform reading patterns

2. LEXICAL ADAPTATIONS:
   - Identify platform-specific vocabulary and slang
   - Define hashtag strategy (if applicable)
   - Set emoji usage guidelines
   - Establish mention and tagging strategy

3. CONTENT FORMAT RULES:
   - Respect character/word limits
   - Optimize paragraph structure for platform
   - Define call-to-action style
   - Set link placement strategy

4. ENGAGEMENT PATTERNS:
   - Determine optimal posting frequency
   - Identify best posting times for audience
   - Define engagement tactics
   - Set community interaction guidelines

5. PLATFORM BEST PRACTICES:
   - List platform-specific optimization techniques
   - Consider algorithm preferences
   - Include trending format adaptations

INSTRUCTIONS:
- Maintain the core persona identity while optimizing for platform performance
- Ensure all adaptations align with the original brand voice
- Consider platform-specific audience behavior
- Provide actionable, specific guidelines

Generate a platform-optimized persona adaptation that maintains brand consistency while maximizing platform performance.
"""
        
        return prompt
    
    # Required persona sections. Used by both the schema and the
    # completeness/confidence calculation in the UI.
    PERSONA_SECTIONS = [
        ("identity",                ["persona_name", "archetype", "core_belief", "brand_voice_description"]),
        ("linguistic_fingerprint",  ["sentence_metrics", "lexical_features", "rhetorical_devices"]),
        ("tonal_range",             ["default_tone", "permissible_tones", "forbidden_tones", "emotional_range"]),
        ("stylistic_constraints",   ["punctuation", "formatting"]),
    ]

    def get_persona_schema(self) -> Dict[str, Any]:
        """Get the schema for core persona generation.

        Every persona MUST include the `evidence` and `what_was_missing`
        sections. The `evidence` field requires the LLM to back up each
        major claim with the data section it came from — no more
        fabricated archetypes. The `what_was_missing` field tells the
        user which data sections were empty so they can plug gaps.
        """
        return {
            "type": "object",
            "properties": {
                "identity": {
                    "type": "object",
                    "properties": {
                        "persona_name":           {"type": "string", "description": "Specific, memorable, e.g. 'The Plain-Spoken Operator' (not generic like 'Expert')"},
                        "archetype":              {"type": "string", "description": "Specific role, e.g. 'No-fluff operator for B2B founders' (not generic like 'thought leader')"},
                        "core_belief":            {"type": "string", "description": "1-2 sentence belief grounded in the data"},
                        "brand_voice_description":{"type": "string", "description": "2-3 sentence description"}
                    },
                    "required": ["persona_name", "archetype", "core_belief", "brand_voice_description"]
                },
                "linguistic_fingerprint": {
                    "type": "object",
                    "properties": {
                        "sentence_metrics": {
                            "type": "object",
                            "properties": {
                                "average_sentence_length_words": {"type": "number"},
                                "preferred_sentence_type":        {"type": "string"},
                                "active_to_passive_ratio":         {"type": "string"},
                                "complexity_level":                {"type": "string"}
                            }
                        },
                        "lexical_features": {
                            "type": "object",
                            "properties": {
                                "go_to_words":     {"type": "array", "items": {"type": "string"}},
                                "go_to_phrases":   {"type": "array", "items": {"type": "string"}, "description": "Verbatim phrases lifted from the brand's own content (see EXTRACTED PHRASES section in prompt)"},
                                "avoid_words":     {"type": "array", "items": {"type": "string"}},
                                "contractions":    {"type": "string"},
                                "filler_words":    {"type": "string"},
                                "vocabulary_level":{"type": "string"}
                            }
                        },
                        "rhetorical_devices": {
                            "type": "object",
                            "properties": {
                                "metaphors":          {"type": "string"},
                                "analogies":          {"type": "string"},
                                "rhetorical_questions":{"type": "string"},
                                "storytelling_style": {"type": "string"}
                            }
                        }
                    }
                },
                "tonal_range": {
                    "type": "object",
                    "properties": {
                        "default_tone":      {"type": "string"},
                        "permissible_tones": {"type": "array", "items": {"type": "string"}},
                        "forbidden_tones":   {"type": "array", "items": {"type": "string"}},
                        "emotional_range":   {"type": "string"}
                    }
                },
                "stylistic_constraints": {
                    "type": "object",
                    "properties": {
                        "punctuation": {
                            "type": "object",
                            "properties": {
                                "ellipses":           {"type": "string"},
                                "em_dash":            {"type": "string"},
                                "exclamation_points": {"type": "string"}
                            }
                        },
                        "formatting": {
                            "type": "object",
                            "properties": {
                                "paragraphs": {"type": "string"},
                                "lists":     {"type": "string"},
                                "markdown":  {"type": "string"}
                            }
                        }
                    }
                },
                "evidence": {
                    "type": "object",
                    "description": "REQUIRED. Back up every major claim in the persona with the data section that led to it. Without this, the persona is rejected.",
                    "properties": {
                        "persona_name_basis": {
                            "type": "string",
                            "description": "Quote the phrase or data point that led to the persona_name (or 'null' if no good basis)"
                        },
                        "archetype_basis": {
                            "type": "string",
                            "description": "Cite which data section led to the archetype (e.g. 'BRAND_DNA values include X, Y' or 'WEBSITE homepage headline says \"...\"')"
                        },
                        "core_belief_basis": {
                            "type": "string",
                            "description": "Cite which data section supports the core_belief"
                        },
                        "tone_basis": {
                            "type": "string",
                            "description": "Cite which data section supports the default_tone"
                        },
                        "verbatim_phrases_used": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "List the exact phrases from the brand's content that influenced go_to_phrases"
                        }
                    },
                    "required": [
                        "persona_name_basis",
                        "archetype_basis",
                        "core_belief_basis",
                        "tone_basis",
                        "verbatim_phrases_used"
                    ]
                },
                "what_was_missing": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "REQUIRED. List the data sections that were empty or too thin to inform the persona. E.g. 'no audience_intelligence', 'competitor_research was empty', 'no verbatim phrases found in crawl_result'. If everything was present, return an empty array."
                },
                "confidence": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1,
                    "description": "REQUIRED. Self-rated confidence in the persona from 0.0 (data-thin) to 1.0 (rich, multi-source data). Calibrate honestly."
                }
            },
            "required": [
                "identity",
                "linguistic_fingerprint",
                "tonal_range",
                "evidence",
                "what_was_missing",
                "confidence"
            ]
        }

    def compute_completeness(self, persona: Dict[str, Any]) -> Dict[str, Any]:
        """
        Compute a 0-1 completeness score from a generated persona.

        For each top-level section in PERSONA_SECTIONS, check whether the
        required sub-fields are populated. The score is the fraction of
        required sub-fields that are non-empty.

        Also returns the list of missing sections (so the UI can show
        "we didn't have audience data" or whatever's missing).
        """
        if not isinstance(persona, dict):
            return {"score": 0.0, "missing": ["persona was not a dict"]}

        total_fields = 0
        filled_fields = 0
        missing_sections: list = []

        for section, fields in self.PERSONA_SECTIONS:
            sec_data = persona.get(section) or {}
            for f in fields:
                total_fields += 1
                val = sec_data.get(f) if isinstance(sec_data, dict) else None
                is_filled = bool(val) and (
                    not isinstance(val, (list, dict, str)) or
                    (isinstance(val, list) and len(val) > 0) or
                    (isinstance(val, str) and val.strip().lower() not in {"", "null", "none"}) or
                    (isinstance(val, dict) and len(val) > 0)
                )
                if is_filled:
                    filled_fields += 1
                else:
                    missing_sections.append(f"{section}.{f}")

        # Include what_was_missing the LLM reported (it's the LLM's own
        # honest assessment of data gaps)
        reported_missing = persona.get("what_was_missing") or []
        if isinstance(reported_missing, list):
            for item in reported_missing:
                if isinstance(item, str) and item.strip():
                    missing_sections.append(f"(reported) {item.strip()}")

        # Dedup
        seen = set()
        deduped = []
        for s in missing_sections:
            if s not in seen:
                seen.add(s)
                deduped.append(s)

        score = (filled_fields / total_fields) if total_fields else 0.0

        # Blend the LLM's self-rated confidence (if any) — but cap it by
        # the structural completeness so a confident LLM doesn't paper
        # over real gaps.
        llm_confidence = persona.get("confidence")
        if isinstance(llm_confidence, (int, float)) and 0 <= llm_confidence <= 1:
            final = min(float(llm_confidence), score)
        else:
            final = score

        return {
            "score": round(final, 2),
            "structural_score": round(score, 2),
            "missing": deduped,
        }
    
    def get_platform_schema(self) -> Dict[str, Any]:
        """Get the schema for platform-specific persona adaptation."""
        return {
            "type": "object",
            "properties": {
                "platform_type": {"type": "string"},
                "sentence_metrics": {
                    "type": "object",
                    "properties": {
                        "max_sentence_length": {"type": "number"},
                        "optimal_sentence_length": {"type": "number"},
                        "sentence_variety": {"type": "string"}
                    }
                },
                "lexical_adaptations": {
                    "type": "object",
                    "properties": {
                        "platform_specific_words": {"type": "array", "items": {"type": "string"}},
                        "hashtag_strategy": {"type": "string"},
                        "emoji_usage": {"type": "string"},
                        "mention_strategy": {"type": "string"}
                    }
                },
                "content_format_rules": {
                    "type": "object",
                    "properties": {
                        "character_limit": {"type": "number"},
                        "paragraph_structure": {"type": "string"},
                        "call_to_action_style": {"type": "string"},
                        "link_placement": {"type": "string"}
                    }
                },
                "engagement_patterns": {
                    "type": "object",
                    "properties": {
                        "posting_frequency": {"type": "string"},
                        "optimal_posting_times": {"type": "array", "items": {"type": "string"}},
                        "engagement_tactics": {"type": "array", "items": {"type": "string"}},
                        "community_interaction": {"type": "string"}
                    }
                },
                "platform_best_practices": {
                    "type": "array",
                    "items": {"type": "string"}
                }
            },
            "required": ["platform_type", "sentence_metrics", "content_format_rules", "engagement_patterns"]
        }
