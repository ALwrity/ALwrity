"""
EnhancedContentGenerator - thin orchestrator for section generation.

Provider parity:
- Uses main_text_generation.llm_text_gen to respect GPT_PROVIDER (Gemini/HF)
- No direct provider coupling here; Google grounding remains in research only
"""

from typing import Any, Dict, List
from datetime import datetime

from services.llm_providers.main_text_generation import llm_text_gen
from .source_url_manager import SourceURLManager
from .context_memory import ContextMemory
from .transition_generator import TransitionGenerator
from .flow_analyzer import FlowAnalyzer
from .persona_block import resolve_curated_persona


class EnhancedContentGenerator:
    def __init__(self):
        self.url_manager = SourceURLManager()
        self.memory = ContextMemory(max_entries=12)
        self.transitioner = TransitionGenerator()
        self.flow = FlowAnalyzer()

    async def generate_section(self, section: Any, research: Any = None, mode: str = "polished", user_id: str = None, competitive_advantage: str = "") -> Dict[str, Any]:
        prev_summary = self.memory.build_previous_sections_summary(limit=2)
        research_context, section_sources = self._build_research_context(section)
        urls = self.url_manager.pick_relevant_urls(section, research) if not research_context else []
        global_research_context = self._build_global_research_context(research, competitive_advantage)
        prompt = self._build_prompt(section, prev_summary, research_context, urls, global_research_context)
        # Curated persona in the SYSTEM prompt (style layer); topic/section stays in the user prompt.
        persona_block = resolve_curated_persona(user_id, 'blog')
        content_text: str = ""
        try:
            ai_resp = llm_text_gen(
                prompt=prompt,
                json_struct=None,
                system_prompt=persona_block or None,
                user_id=user_id
            )
            if isinstance(ai_resp, dict) and ai_resp.get("text"):
                content_text = ai_resp.get("text", "")
            elif isinstance(ai_resp, str):
                content_text = ai_resp
            else:
                content_text = str(ai_resp or "")
        except Exception as e:
            content_text = ""

        result = {
            "content": content_text,
            "sources": section_sources,
        }
        previous_text = prev_summary
        current_text = result.get("content", "")
        transition = self.transitioner.generate_transition(previous_text, getattr(section, 'heading', 'This section'), use_llm=True)
        metrics = self.flow.assess_flow(previous_text, current_text, use_llm=True)
        if current_text:
            self.memory.update_with_section(getattr(section, 'id', 'unknown'), current_text, use_llm=True)
        result["transition"] = transition
        result["continuity_metrics"] = metrics
        try:
            sid = getattr(section, 'id', 'unknown')
            if not hasattr(self, "_last_continuity"):
                self._last_continuity = {}
            self._last_continuity[sid] = metrics
        except Exception:
            pass
        return result

    def _build_research_context(self, section: Any) -> tuple:
        """Build a rich research context block from the section's mapped sources.
        
        Returns (context_string, sources_list) where context_string is the
        formatted research context for the prompt, and sources_list contains
        {title, url} dicts for downstream use.
        
        When section.references is empty, returns ("", []) — the caller should
        handle this as a research gap and avoid generating unsupported claims.
        """
        references = getattr(section, 'references', []) or []
        if not references:
            return ("", [])

        context_parts = []
        sources_out = []
        for i, ref in enumerate(references, 1):
            if isinstance(ref, dict):
                title = ref.get('title', '')
                excerpt = ref.get('excerpt', '')
                highlights = ref.get('highlights', []) or []
                summary = ref.get('summary', '')
                url = ref.get('url', '')
                content = ref.get('content', '') or ''
                author = ref.get('author', '') or ''
                source_type = ref.get('source_type', '') or ''
                credibility_score = ref.get('credibility_score')
                published_at = ref.get('published_at', '') or ''
            else:
                title = getattr(ref, 'title', '')
                excerpt = getattr(ref, 'excerpt', '')
                highlights = getattr(ref, 'highlights', []) or []
                summary = getattr(ref, 'summary', '')
                url = getattr(ref, 'url', '')
                content = getattr(ref, 'content', '') or ''
                author = getattr(ref, 'author', '') or ''
                source_type = getattr(ref, 'source_type', '') or ''
                credibility_score = getattr(ref, 'credibility_score', None)
                published_at = getattr(ref, 'published_at', '') or ''

            sources_out.append({"title": title, "url": url})

            attribution_parts = []
            if author:
                attribution_parts.append(f"by {author}")
            if source_type:
                attribution_parts.append(f"[{source_type}]")
            attribution = " ".join(attribution_parts)
            credibility_tag = ""
            if credibility_score is not None:
                try:
                    score = float(credibility_score)
                    if score >= 0.9:
                        credibility_tag = " (high-credibility)"
                    elif score >= 0.75:
                        credibility_tag = " (credible)"
                except (ValueError, TypeError):
                    pass
            recency_tag = ""
            if published_at:
                recency_tag = f" (published {published_at[:10]})" if len(published_at) >= 10 else f" (published {published_at})"

            header = f"Source {i}: {title}"
            if attribution:
                header += f" {attribution}"
            header += f"{credibility_tag}{recency_tag}"
            part = header + "\n"
            if summary:
                part += f"  Summary: {summary[:1000]}\n"
            if excerpt:
                part += f"  Key excerpt: {excerpt[:1000]}\n"
            if content and not summary and not excerpt:
                part += f"  Content: {content[:800]}\n"
            if highlights:
                part += "  Key findings:\n"
                for h in highlights[:3]:
                    h_text = h[:500] if h else ''
                    if h_text:
                        part += f"  - {h_text}\n"

            context_parts.append(part)

        return ("\n".join(context_parts), sources_out)

    def _build_global_research_context(self, research: Any, competitive_advantage: str = "") -> str:
        """Build global research context from the full BlogResearchResponse object.
        
        Extracts keyword_analysis, competitor_analysis, search_queries,
        and competitive_advantage into a compact context block that provides
        the LLM with strategic direction beyond per-section sources.
        """
        if research is None:
            return ""
        parts = []

        ka = getattr(research, 'keyword_analysis', None) or {}
        if ka:
            primary = ka.get('primary', [])
            secondary = ka.get('secondary', [])
            search_intent = ka.get('search_intent', '')
            kw_lines = []
            if primary:
                kw_lines.append(f"Primary keywords: {', '.join(primary[:10])}")
            if secondary:
                kw_lines.append(f"Secondary keywords: {', '.join(secondary[:10])}")
            if search_intent:
                kw_lines.append(f"Search intent: {search_intent}")
            if kw_lines:
                parts.append("=== KEYWORD & SEARCH STRATEGY ===\n" + "\n".join(kw_lines))

        ca = getattr(research, 'competitor_analysis', None) or {}
        if ca:
            ca_lines = []
            content_gaps = ca.get('content_gaps', [])
            if content_gaps:
                ca_lines.append(f"Content gaps (address these): {', '.join(content_gaps[:5])}")
            industry_leaders = ca.get('industry_leaders', [])
            if industry_leaders:
                ca_lines.append(f"Industry leaders: {', '.join(industry_leaders[:5])}")
            opportunities = ca.get('opportunities', [])
            if opportunities:
                ca_lines.append(f"Opportunities: {', '.join(opportunities[:5])}")
            if ca_lines:
                parts.append("=== COMPETITIVE LANDSCAPE ===\n" + "\n".join(ca_lines))

        sq = getattr(research, 'search_queries', None) or []
        if sq:
            parts.append(f"=== SEARCH INTENT SIGNALS ===\nOriginal search queries: {', '.join(sq[:8])}")

        if competitive_advantage:
            parts.append(f"=== COMPETITIVE ADVANTAGE ===\nEmphasize this differentiator: {competitive_advantage}")

        return "\n\n".join(parts) if parts else ""

    def _build_prompt(self, section: Any, prev_summary: str, research_context: str, urls: list, global_research_context: str = "") -> str:
        heading = getattr(section, 'heading', 'Section')
        key_points = getattr(section, 'key_points', [])
        keywords = getattr(section, 'keywords', [])
        subheadings = getattr(section, 'subheadings', []) or []
        target_words = getattr(section, 'target_words', 300)

        prompt = (
            f"You are writing the blog section '{heading}'.\n\n"
            f"Context summary (previous sections): {prev_summary}\n\n"
            f"Authoring requirements:\n"
            f"- Target word count: ~{target_words}\n"
            f"- Use the following key points: {', '.join(key_points)}\n"
            f"- Include these keywords naturally: {', '.join(keywords)}\n"
            f"- Use facts and statistics that feel current for {datetime.now().strftime('%B %Y')}\n"
        )

        if subheadings:
            prompt += f"- Cover these subtopics: {', '.join(subheadings)}\n"

        if global_research_context:
            prompt += f"\n{global_research_context}\n\n"

        if research_context:
            prompt += (
                f"\nResearch sources for this section (use these facts, statistics, "
                f"and insights to support your writing):\n{research_context}\n\n"
                "IMPORTANT: Base your writing on the research sources above. "
                "Use specific facts, statistics, and data from these sources. "
                "Do not invent numbers, statistics, or claims not supported by the research.\n"
            )
        elif urls:
            import logging
            logging.getLogger('content_generator').warning(
                f"No research context for section '{heading}' — falling back to bare URLs"
            )
            url_lines = []
            for u in urls:
                if isinstance(u, dict):
                    url_lines.append(f"- {u.get('title','')} ({u.get('url','')})")
                else:
                    url_lines.append(f"- {u}")
            prompt += f"\nReference URLs (consult for additional context):\n" + "\n".join(url_lines) + "\n"

        prompt += (
            "\nWrite engaging, well-structured markdown with clear paragraphs "
            "(2-4 sentences each) separated by double line breaks."
        )

        return prompt


