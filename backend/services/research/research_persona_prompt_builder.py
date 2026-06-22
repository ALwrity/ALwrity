"""
Research Persona Prompt Builder

Handles building comprehensive prompts for research persona generation.
Generates personalized research defaults, suggestions, and configurations.
"""

from typing import Dict, Any, List, Optional
import json
from loguru import logger


class ResearchPersonaPromptBuilder:
    """Builds comprehensive prompts for research persona generation."""
    
    def build_research_persona_prompt(self, onboarding_data: Dict[str, Any]) -> str:
        """Build the research persona generation prompt with comprehensive data."""
        
        # Extract data from onboarding_data
        website_analysis = onboarding_data.get("website_analysis", {}) or {}
        persona_data = onboarding_data.get("persona_data", {}) or {}
        research_prefs = onboarding_data.get("research_preferences", {}) or {}
        business_info = onboarding_data.get("business_info", {}) or {}
        competitor_analysis = onboarding_data.get("competitor_analysis", []) or []
        
        # Extract core persona - handle both camelCase and snake_case
        core_persona = persona_data.get("corePersona") or persona_data.get("core_persona") or {}
        
        # Phase 1: Extract key website analysis fields for enhanced personalization
        writing_style = website_analysis.get("writing_style", {}) or {}
        content_type = website_analysis.get("content_type", {}) or {}
        crawl_result = website_analysis.get("crawl_result", {}) or {}
        
        # Phase 2: Extract additional fields for pattern-based personalization
        style_patterns = website_analysis.get("style_patterns", {}) or {}
        content_characteristics = website_analysis.get("content_characteristics", {}) or {}
        style_guidelines = website_analysis.get("style_guidelines", {}) or {}
        
        # Extract topics/keywords from crawl_result (if available)
        extracted_topics = self._extract_topics_from_crawl(crawl_result)
        extracted_keywords = self._extract_keywords_from_crawl(crawl_result)
        
        # Phase 2: Extract patterns and vocabulary level
        extracted_patterns = self._extract_writing_patterns(style_patterns)
        vocabulary_level = content_characteristics.get("vocabulary_level", "medium") if content_characteristics else "medium"
        extracted_guidelines = self._extract_style_guidelines(style_guidelines)
        
        # Phase 3: Full crawl analysis and comprehensive mapping
        crawl_analysis = self._analyze_crawl_result_comprehensive(crawl_result)
        writing_style_mapping = self._map_writing_style_comprehensive(writing_style, content_characteristics)
        content_themes = self._extract_content_themes(crawl_result, extracted_topics)
        
        prompt = f"""
COMPREHENSIVE RESEARCH PERSONA GENERATION TASK: Create a highly detailed, personalized research persona based on the user's business, writing style, and content strategy. This persona will provide intelligent defaults and suggestions for research inputs.

=== USER CONTEXT ===

BUSINESS INFORMATION:
{json.dumps(business_info, indent=2)}

WEBSITE ANALYSIS:
{json.dumps(website_analysis, indent=2)}

CORE PERSONA:
{json.dumps(core_persona, indent=2)}

RESEARCH PREFERENCES:
{json.dumps(research_prefs, indent=2)}

COMPETITOR ANALYSIS:
{json.dumps(competitor_analysis, indent=2) if competitor_analysis else "No competitor data available"}

=== PHASE 1: WEBSITE ANALYSIS INTELLIGENCE ===

WRITING STYLE (for research depth mapping):
{json.dumps(writing_style, indent=2) if writing_style else "Not available"}

CONTENT TYPE (for preset generation):
{json.dumps(content_type, indent=2) if content_type else "Not available"}

EXTRACTED TOPICS FROM WEBSITE CONTENT:
{json.dumps(extracted_topics, indent=2) if extracted_topics else "No topics extracted"}

EXTRACTED KEYWORDS FROM WEBSITE CONTENT:
{json.dumps(extracted_keywords[:20], indent=2) if extracted_keywords else "No keywords extracted"}

=== PHASE 2: WRITING PATTERNS & STYLE INTELLIGENCE ===

STYLE PATTERNS (for research angles):
{json.dumps(style_patterns, indent=2) if style_patterns else "Not available"}

EXTRACTED WRITING PATTERNS:
{json.dumps(extracted_patterns, indent=2) if extracted_patterns else "No patterns extracted"}

CONTENT CHARACTERISTICS (for keyword sophistication):
{json.dumps(content_characteristics, indent=2) if content_characteristics else "Not available"}

VOCABULARY LEVEL:
{vocabulary_level}

STYLE GUIDELINES (for query enhancement):
{json.dumps(style_guidelines, indent=2) if style_guidelines else "Not available"}

EXTRACTED GUIDELINES:
{json.dumps(extracted_guidelines, indent=2) if extracted_guidelines else "No guidelines extracted"}

=== PHASE 3: COMPREHENSIVE ANALYSIS & MAPPING ===

CRAWL ANALYSIS (Full Content Intelligence):
{json.dumps(crawl_analysis, indent=2) if crawl_analysis else "No crawl analysis available"}

WRITING STYLE COMPREHENSIVE MAPPING:
{json.dumps(writing_style_mapping, indent=2) if writing_style_mapping else "No style mapping available"}

CONTENT THEMES (Extracted from Website):
{json.dumps(content_themes, indent=2) if content_themes else "No themes extracted"}

=== RESEARCH PERSONA GENERATION REQUIREMENTS ===

Generate a comprehensive research persona in JSON format with the following structure:

1. DEFAULT VALUES:
   - "default_industry": Extract from core_persona.industry, business_info.industry, or website_analysis target_audience. If none available, infer from content patterns in website_analysis or research_preferences. Never use "General" - always provide a specific industry based on context.
   - "default_target_audience": Extract from core_persona.target_audience, website_analysis.target_audience, or business_info.target_audience. Be specific and descriptive.
   - "default_research_mode": **PHASE 3 ENHANCEMENT** - Use comprehensive writing_style_mapping:
     * **PRIMARY**: Use writing_style_mapping.research_depth_preference (from comprehensive analysis)
     * **SECONDARY**: Map from writing_style.complexity:
       - If writing_style.complexity == "high": Use "comprehensive" (deep research needed)
       - If writing_style.complexity == "medium": Use "targeted" (balanced research)
       - If writing_style.complexity == "low": Use "basic" (quick research)
     * **FALLBACK**: Use research_preferences.research_depth if complexity not available
     * This ensures research depth matches the user's writing sophistication level and comprehensive style analysis
   - "default_provider": **PHASE 3 ENHANCEMENT** - Use writing_style_mapping.provider_preference:
     * **PRIMARY**: Use writing_style_mapping.provider_preference (from comprehensive style analysis)
     * **SECONDARY**: Suggest based on user's typical research needs:
       - Academic/research users: "exa" (semantic search, papers)
       - News/current events users: "tavily" (real-time, AI answers)
       - General business users: "exa" (better for content creation)
     * **DEFAULT**: "exa" (generally better for content creators)

2. KEYWORD INTELLIGENCE:
   - "suggested_keywords": **PHASE 1 ENHANCEMENT** - Prioritize extracted keywords from crawl_result:
     * First, use extracted_keywords from website content (top 8-10 most relevant)
     * Then, supplement with keywords from user's industry, interests (from core_persona), and content goals
     * Total: 8-12 keywords, with at least 50% from extracted_keywords if available
     * This ensures keywords reflect the user's actual content topics
   - "keyword_expansion_patterns": **PHASE 2 ENHANCEMENT** - Create a dictionary mapping common keywords to expanded, industry-specific terms based on vocabulary_level:
     * If vocabulary_level == "advanced": Use sophisticated, technical, industry-specific terminology
       Example: {{"AI": ["machine learning algorithms", "neural network architectures", "deep learning frameworks", "algorithmic intelligence systems"], "tools": ["enterprise software platforms", "integrated development environments", "cloud-native solutions"]}}
     * If vocabulary_level == "medium": Use balanced, professional terminology
       Example: {{"AI": ["artificial intelligence", "automated systems", "smart technology", "intelligent automation"], "tools": ["software solutions", "digital platforms", "business applications"]}}
     * If vocabulary_level == "simple": Use accessible, beginner-friendly terminology
       Example: {{"AI": ["smart technology", "automated tools", "helpful software", "intelligent helpers"], "tools": ["apps", "software", "platforms", "online services"]}}
     * Include 10-15 patterns, matching the user's vocabulary sophistication level
     * Focus on industry-specific terminology from the user's domain, but at the appropriate complexity level

3. PROVIDER-SPECIFIC OPTIMIZATION:
   - "suggested_exa_domains": List 4-6 authoritative domains for the user's industry (e.g., Healthcare: ["pubmed.gov", "nejm.org", "thelancet.com"]).
   - "suggested_exa_category": Suggest appropriate Exa category based on industry:
     - Healthcare/Science: "research paper"
     - Finance: "financial report"
     - Technology/Business: "company" or "news"
     - Social Media/Marketing: "tweet" or "linkedin profile"
     - Default: null (empty string for all categories)
   - "suggested_exa_search_type": Suggest Exa search algorithm:
     - Academic/research content: "neural" (semantic understanding)
     - Current news/trends: "fast" (speed optimized)
     - General research: "auto" (balanced)
     - Code/technical: "neural"
   - "suggested_tavily_topic": Choose based on content type:
     - Financial content: "finance"
     - News/current events: "news"
     - General research: "general"
   - "suggested_tavily_search_depth": Choose based on research needs:
     - Quick overview: "basic" (1 credit, faster)
     - In-depth analysis: "advanced" (2 credits, more comprehensive)
     - Breaking news: "fast" (speed optimized)
   - "suggested_tavily_include_answer": AI-generated answers:
     - For factual queries needing quick answers: "advanced"
     - For research summaries: "basic"
     - When building custom content: "false" (use raw results)
   - "suggested_tavily_time_range": Time filtering:
     - Breaking news: "day"
     - Recent developments: "week"
     - Industry analysis: "month"
     - Historical research: null (no time limit)
   - "suggested_tavily_raw_content_format": Raw content for LLM processing:
     - For blog content creation: "markdown" (structured)
     - For simple text extraction: "text"
     - No raw content needed: "false"
   - "provider_recommendations": Map use cases to best providers:
     {{"trends": "tavily", "deep_research": "exa", "factual": "google", "news": "tavily", "academic": "exa"}}

4. RESEARCH ANGLES:
   - "research_angles": **PHASE 2 ENHANCEMENT** - Generate 5-8 alternative research angles/focuses based on:
     * **PRIMARY SOURCE**: Extract from extracted_patterns (writing patterns from style_patterns):
       - If "comparison" in patterns: "Compare {{topic}} solutions and alternatives"
       - If "how-to" or "tutorial" in patterns: "Step-by-step guide to {{topic}} implementation"
       - If "case-study" or "case_study" in patterns: "Real-world {{topic}} case studies and success stories"
       - If "trend-analysis" or "trends" in patterns: "Latest {{topic}} trends and future predictions"
       - If "best-practices" or "best_practices" in patterns: "{{topic}} best practices and industry standards"
       - If "review" or "evaluation" in patterns: "{{topic}} review and evaluation criteria"
       - If "problem-solving" in patterns: "{{topic}} problem-solving strategies and solutions"
     * **SECONDARY SOURCES** (if patterns not available):
       - User's pain points and challenges (from core_persona.identity or core_persona)
       - Industry trends and opportunities (from website_analysis or business_info)
       - Content goals (from research_preferences.content_types)
       - Audience interests (from core_persona or website_analysis.target_audience)
       - Competitive landscape (if competitor_analysis exists, include competitive angles)
     * Make angles specific to the user's industry and actionable for content creation
     * Use the same language style and structure as the user's writing patterns

5. QUERY ENHANCEMENT:
   - "query_enhancement_rules": **PHASE 2 ENHANCEMENT** - Create templates for improving vague user queries based on extracted_guidelines:
     * **PRIMARY SOURCE**: Use extracted_guidelines (from style_guidelines) to create enhancement rules:
       - If guidelines include "Use specific examples": {{"vague_query": "Research: {{query}} with specific examples and case studies"}}
       - If guidelines include "Include data points" or "statistics": {{"general_query": "Research: {{query}} including statistics, metrics, and data analysis"}}
       - If guidelines include "Reference industry standards": {{"basic_query": "Research: {{query}} with industry benchmarks and best practices"}}
       - If guidelines include "Cite authoritative sources": {{"factual_query": "Research: {{query}} from authoritative sources and expert opinions"}}
       - If guidelines include "Provide actionable insights": {{"theoretical_query": "Research: {{query}} with actionable strategies and implementation steps"}}
       - If guidelines include "Compare alternatives": {{"single_item_query": "Research: Compare {{query}} alternatives and evaluate options"}}
     * **FALLBACK PATTERNS** (if guidelines not available):
       {{"vague_ai": "Research: AI applications in {{industry}} for {{audience}}", "vague_tools": "Compare top {{industry}} tools", "vague_trends": "Research latest {{industry}} trends and developments", ...}}
     * Include 5-8 enhancement patterns
     * Match the enhancement style to the user's writing guidelines and preferences

6. RECOMMENDED PRESETS:
    - "recommended_presets": **PHASE 3 ENHANCEMENT** - Generate 3-5 personalized research preset templates using comprehensive analysis:
      * **USE CONTENT THEMES**: If content_themes available, create at least one preset per major theme (up to 3 themes)
        - Example: If themes include ["AI automation", "content marketing", "SEO strategies"], create presets for each
        - Use theme names in preset keywords: "Research latest {{theme}} trends and best practices"
      * **USE CRAWL ANALYSIS**: Leverage crawl_analysis.content_categories and crawl_analysis.main_topics for preset generation
        - Create presets that match the user's actual website content categories
        - Use main_topics for preset keywords and descriptions
      * **CONTENT TYPE BASED**: Generate presets based on content_type (from Phase 1):
      * **Content-Type-Specific Presets**: Use content_type.primary_type and content_type.secondary_types to create presets:
        - If primary_type == "blog": Create "Blog Topic Research" preset with trending topics
        - If primary_type == "article": Create "Article Research" preset with in-depth analysis
        - If primary_type == "case_study": Create "Case Study Research" preset with real-world examples
        - If primary_type == "tutorial": Create "Tutorial Research" preset with step-by-step guides
        - If "tutorial" in secondary_types: Add "How-To Guide Research" preset
        - If "comparison" in secondary_types or style_patterns: Add "Comparison Research" preset
        - If content_type.purpose == "thought_leadership": Create "Thought Leadership Research" with expert insights
        - If content_type.purpose == "education": Create "Educational Content Research" preset
      * **Use Extracted Topics**: If extracted_topics available, create at least one preset using actual website topics:
        - "Latest {{extracted_topic}} Trends" preset
        - "{{extracted_topic}} Best Practices" preset
     * Each preset should include:
       - name: Descriptive, action-oriented name that clearly indicates what research will be done
          * Use research_angles as inspiration for preset names (e.g., "Compare {{Industry}} Tools", "{{Industry}} ROI Analysis")
          * If competitor_analysis exists, create at least one competitive analysis preset (e.g., "Competitive Landscape Analysis")
          * Make names specific and actionable, not generic
          * **NEW**: Include content type in name when relevant (e.g., "Blog: {{Industry}} Trends", "Tutorial: {{Topic}} Guide")
       - keywords: Research query string that is:
         * **NEW**: Use extracted_topics and extracted_keywords when available for more relevant queries
         * Specific and detailed (not vague like "AI tools")
         * Industry-focused (includes industry context)
         * Audience-aware (considers target audience needs)
         * Actionable (user can immediately understand what research will provide)
         * Examples: "Research latest AI-powered marketing automation platforms for B2B SaaS companies" (GOOD)
         * Avoid: "AI tools" or "marketing research" (TOO VAGUE)
       - industry: User's industry (from business_info or inferred)
       - target_audience: User's target audience (from business_info or inferred)
       - research_mode: "basic", "comprehensive", or "targeted" based on:
         * **NEW**: Also consider content_type.purpose:
           - "thought_leadership" → "comprehensive" (needs deep research)
           - "education" → "comprehensive" (needs thorough coverage)
           - "marketing" → "targeted" (needs specific insights)
           - "entertainment" → "basic" (needs quick facts)
         * "comprehensive" for deep analysis, trends, competitive research
         * "targeted" for specific questions, quick insights
         * "basic" for simple fact-finding
       - config: Complete ResearchConfig object with:
         * provider: Use suggested_exa_category to determine if "exa" or "tavily" is better
         * exa_category: Use suggested_exa_category if available
         * exa_include_domains: Use suggested_exa_domains if available (limit to 3-5 most relevant)
         * exa_search_type: Use suggested_exa_search_type if available
         * max_sources: 15-25 for comprehensive, 10-15 for targeted, 8-12 for basic
         * include_competitors: true if competitor_analysis exists and preset is about competitive research
         * include_trends: true for trend-focused presets
         * include_statistics: true for data-driven research
         * include_expert_quotes: true for comprehensive research or thought_leadership content
       - description: Brief (1-2 sentences) explaining what this preset researches and why it's valuable
       - icon: Optional emoji that represents the preset (e.g., "📊" for trends, "🎯" for targeted, "🔍" for analysis, "📝" for blog, "📚" for tutorial)
       - gradient: Optional CSS gradient for visual appeal
   
   PRESET GENERATION GUIDELINES:
   - **PHASE 1 PRIORITY**: Create presets that match the user's actual content types (from content_type)
   - Use extracted_topics to create presets based on actual website content
   - Create presets that the user would actually want to use for their content creation
   - Use research_angles to inspire preset names and keywords
   - If competitor_analysis has data, create at least one competitive analysis preset
   - Make each preset unique with different research focus (trends, tools, best practices, competitive, etc.)
   - Ensure keywords are detailed enough to generate meaningful research
   - Vary research_mode across presets to offer different depth levels
   - Use industry-specific terminology in preset names and keywords

7. RESEARCH PREFERENCES:
   - "research_preferences": Extract and structure research preferences from onboarding:
     - research_depth: From research_preferences.research_depth
     - content_types: From research_preferences.content_types
     - auto_research: From research_preferences.auto_research
     - factual_content: From research_preferences.factual_content

=== OUTPUT REQUIREMENTS ===

Return a valid JSON object matching this exact structure:
{{
  "default_industry": "string",
  "default_target_audience": "string",
  "default_research_mode": "basic" | "comprehensive" | "targeted",
  "default_provider": "google" | "exa",
  "suggested_keywords": ["keyword1", "keyword2", ...],
  "keyword_expansion_patterns": {{
    "keyword": ["expansion1", "expansion2", ...]
  }},
   "suggested_exa_domains": ["domain1.com", "domain2.com", ...],
   "suggested_exa_category": "string or null",
   "suggested_exa_search_type": "auto | neural | keyword | fast | deep",
   "suggested_tavily_topic": "general | news | finance",
   "suggested_tavily_search_depth": "basic | advanced | fast | ultra-fast",
   "suggested_tavily_include_answer": "false | basic | advanced",
   "suggested_tavily_time_range": "day | week | month | year or null",
   "suggested_tavily_raw_content_format": "false | markdown | text",
   "provider_recommendations": {{
     "trends": "tavily",
     "deep_research": "exa",
     "factual": "google"
   }},
  "research_angles": ["angle1", "angle2", ...],
  "query_enhancement_rules": {{
    "pattern": "template"
  }},
  "recommended_presets": [
    {{
      "name": "string",
      "keywords": "string",
      "industry": "string",
      "target_audience": "string",
      "research_mode": "basic" | "comprehensive" | "targeted",
      "config": {{
        "mode": "basic" | "comprehensive" | "targeted",
        "provider": "google" | "exa",
        "max_sources": 10 | 15 | 12,
        "include_statistics": true | false,
        "include_expert_quotes": true | false,
        "include_competitors": true | false,
        "include_trends": true | false,
        "exa_category": "string or null",
        "exa_include_domains": ["domain1.com", ...],
        "exa_search_type": "auto" | "keyword" | "neural"
      }},
      "description": "string"
    }}
  ],
  "research_preferences": {{
    "research_depth": "string",
    "content_types": ["type1", "type2", ...],
    "auto_research": true | false,
    "factual_content": true | false
  }},
  "version": "1.0",
  "confidence_score": 85.0
}}

=== IMPORTANT INSTRUCTIONS ===

1. Be highly specific and personalized - use actual data from the user's business, persona, and preferences.
2. NEVER use "General" for industry or target_audience - always infer or create specific categories based on available context.
3. For minimal data scenarios:
   - If industry is unclear, infer from research_preferences.content_types or website_analysis.content_characteristics
   - If target_audience is unclear, infer from writing_style patterns or content goals
   - Use business_info to fill gaps when persona_data is incomplete
4. Generate industry-specific intelligence even with limited data:
   - For content creators: assume "Content Marketing" or "Digital Publishing"
   - For business users: assume "Business Consulting" or "Professional Services"
   - For technical users: assume "Technology" or "Software Development"
5. Ensure all suggested keywords, domains, and angles are relevant to the user's industry and audience.
6. Generate realistic, actionable presets that the user would actually want to use.
7. Confidence score should reflect data richness (0-100): higher if rich onboarding data, lower if minimal data.
8. Return ONLY valid JSON - no markdown formatting, no explanatory text.

Generate the research persona now:
"""
        
        return prompt
    
    def _extract_topics_from_crawl(self, crawl_result: Dict[str, Any]) -> List[str]:
        """
        Extract topics from crawl_result JSON data.
        
        Args:
            crawl_result: Dictionary containing crawled website data
            
        Returns:
            List of extracted topics (max 15)
        """
        topics = []
        
        if not crawl_result:
            return topics
        
        try:
            # Try to extract from common crawl result structures
            # Method 1: Direct topics field
            if isinstance(crawl_result.get('topics'), list):
                topics.extend(crawl_result['topics'][:10])
            
            # Method 2: Extract from headings
            if isinstance(crawl_result.get('headings'), list):
                headings = crawl_result['headings']
                # Filter out common non-topic headings
                filtered_headings = [
                    h for h in headings[:15] 
                    if h and len(h.strip()) > 3 
                    and h.lower() not in ['home', 'about', 'contact', 'menu', 'navigation', 'footer', 'header']
                ]
                topics.extend(filtered_headings)
            
            # Method 3: Extract from page titles
            if isinstance(crawl_result.get('titles'), list):
                titles = crawl_result['titles']
                topics.extend([t for t in titles[:10] if t and len(t.strip()) > 3])
            
            # Method 4: Extract from content sections
            if isinstance(crawl_result.get('sections'), list):
                sections = crawl_result['sections']
                for section in sections[:10]:
                    if isinstance(section, dict):
                        section_title = section.get('title') or section.get('heading')
                        if section_title and len(section_title.strip()) > 3:
                            topics.append(section_title)
            
            # Method 5: Extract from metadata
            if isinstance(crawl_result.get('metadata'), dict):
                meta = crawl_result['metadata']
                if meta.get('title'):
                    topics.append(meta['title'])
                if isinstance(meta.get('keywords'), list):
                    topics.extend(meta['keywords'][:5])
            
            # Remove duplicates and clean
            unique_topics = []
            seen = set()
            for topic in topics:
                if topic and isinstance(topic, str):
                    cleaned = topic.strip()
                    if cleaned and cleaned.lower() not in seen:
                        seen.add(cleaned.lower())
                        unique_topics.append(cleaned)
            
            return unique_topics[:15]  # Limit to 15 topics
            
        except Exception as e:
            logger.debug(f"Error extracting topics from crawl_result: {e}")
            return []
    
    def _extract_keywords_from_crawl(self, crawl_result: Dict[str, Any]) -> List[str]:
        """
        Extract keywords from crawl_result JSON data.
        
        Args:
            crawl_result: Dictionary containing crawled website data
            
        Returns:
            List of extracted keywords (max 20)
        """
        keywords = []
        
        if not crawl_result:
            return keywords
        
        try:
            # Method 1: Direct keywords field
            if isinstance(crawl_result.get('keywords'), list):
                keywords.extend(crawl_result['keywords'][:15])
            
            # Method 2: Extract from metadata keywords
            if isinstance(crawl_result.get('metadata'), dict):
                meta = crawl_result['metadata']
                if isinstance(meta.get('keywords'), list):
                    keywords.extend(meta['keywords'][:10])
                if meta.get('description'):
                    # Extract potential keywords from description (simple word extraction)
                    desc = meta['description']
                    words = [w.strip() for w in desc.split() if len(w.strip()) > 4]
                    keywords.extend(words[:5])
            
            # Method 3: Extract from tags
            if isinstance(crawl_result.get('tags'), list):
                keywords.extend(crawl_result['tags'][:10])
            
            # Method 4: Extract from content (simple frequency-based, if available)
            if isinstance(crawl_result.get('content'), str):
                content = crawl_result['content']
                # Simple extraction: words that appear multiple times and are > 4 chars
                words = content.lower().split()
                word_freq = {}
                for word in words:
                    cleaned = ''.join(c for c in word if c.isalnum())
                    if len(cleaned) > 4:
                        word_freq[cleaned] = word_freq.get(cleaned, 0) + 1
                
                # Get top keywords by frequency
                sorted_words = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
                keywords.extend([word for word, freq in sorted_words[:10] if freq > 1])
            
            # Remove duplicates and clean
            unique_keywords = []
            seen = set()
            for keyword in keywords:
                if keyword and isinstance(keyword, str):
                    cleaned = keyword.strip().lower()
                    if cleaned and len(cleaned) > 2 and cleaned not in seen:
                        seen.add(cleaned)
                        unique_keywords.append(keyword.strip())
            
            return unique_keywords[:20]  # Limit to 20 keywords
            
        except Exception as e:
            logger.debug(f"Error extracting keywords from crawl_result: {e}")
            return []
    
    def _extract_writing_patterns(self, style_patterns: Dict[str, Any]) -> List[str]:
        """
        Extract writing patterns from style_patterns JSON data.
        
        Args:
            style_patterns: Dictionary containing writing patterns analysis
            
        Returns:
            List of extracted patterns (max 10)
        """
        patterns = []
        
        if not style_patterns:
            return patterns
        
        try:
            # Method 1: Direct patterns field
            if isinstance(style_patterns.get('patterns'), list):
                patterns.extend(style_patterns['patterns'][:10])
            
            # Method 2: Common patterns field
            if isinstance(style_patterns.get('common_patterns'), list):
                patterns.extend(style_patterns['common_patterns'][:10])
            
            # Method 3: Writing patterns field
            if isinstance(style_patterns.get('writing_patterns'), list):
                patterns.extend(style_patterns['writing_patterns'][:10])
            
            # Method 4: Content structure patterns
            if isinstance(style_patterns.get('content_structure'), dict):
                structure = style_patterns['content_structure']
                if isinstance(structure.get('patterns'), list):
                    patterns.extend(structure['patterns'][:5])
            
            # Method 5: Extract from analysis field
            if isinstance(style_patterns.get('analysis'), dict):
                analysis = style_patterns['analysis']
                if isinstance(analysis.get('identified_patterns'), list):
                    patterns.extend(analysis['identified_patterns'][:10])
            
            # Normalize patterns (lowercase, remove duplicates)
            normalized_patterns = []
            seen = set()
            for pattern in patterns:
                if pattern and isinstance(pattern, str):
                    cleaned = pattern.strip().lower().replace('_', '-').replace(' ', '-')
                    if cleaned and cleaned not in seen:
                        seen.add(cleaned)
                        normalized_patterns.append(cleaned)
            
            return normalized_patterns[:10]  # Limit to 10 patterns
            
        except Exception as e:
            logger.debug(f"Error extracting writing patterns: {e}")
            return []
    
    def _extract_style_guidelines(self, style_guidelines: Dict[str, Any]) -> List[str]:
        """
        Extract style guidelines from style_guidelines JSON data.
        
        Args:
            style_guidelines: Dictionary containing generated style guidelines
            
        Returns:
            List of extracted guidelines (max 15)
        """
        guidelines = []
        
        if not style_guidelines:
            return guidelines
        
        try:
            # Method 1: Direct guidelines field
            if isinstance(style_guidelines.get('guidelines'), list):
                guidelines.extend(style_guidelines['guidelines'][:15])
            
            # Method 2: Recommendations field
            if isinstance(style_guidelines.get('recommendations'), list):
                guidelines.extend(style_guidelines['recommendations'][:15])
            
            # Method 3: Best practices field
            if isinstance(style_guidelines.get('best_practices'), list):
                guidelines.extend(style_guidelines['best_practices'][:10])
            
            # Method 4: Tone recommendations
            if isinstance(style_guidelines.get('tone_recommendations'), list):
                guidelines.extend(style_guidelines['tone_recommendations'][:5])
            
            # Method 5: Structure guidelines
            if isinstance(style_guidelines.get('structure_guidelines'), list):
                guidelines.extend(style_guidelines['structure_guidelines'][:5])
            
            # Method 6: Vocabulary suggestions
            if isinstance(style_guidelines.get('vocabulary_suggestions'), list):
                guidelines.extend(style_guidelines['vocabulary_suggestions'][:5])
            
            # Method 7: Engagement tips
            if isinstance(style_guidelines.get('engagement_tips'), list):
                guidelines.extend(style_guidelines['engagement_tips'][:5])
            
            # Method 8: Audience considerations
            if isinstance(style_guidelines.get('audience_considerations'), list):
                guidelines.extend(style_guidelines['audience_considerations'][:5])
            
            # Method 9: SEO optimization (if available)
            if isinstance(style_guidelines.get('seo_optimization'), list):
                guidelines.extend(style_guidelines['seo_optimization'][:3])
            
            # Method 10: Conversion optimization (if available)
            if isinstance(style_guidelines.get('conversion_optimization'), list):
                guidelines.extend(style_guidelines['conversion_optimization'][:3])
            
            # Remove duplicates and clean
            unique_guidelines = []
            seen = set()
            for guideline in guidelines:
                if guideline and isinstance(guideline, str):
                    cleaned = guideline.strip()
                    # Normalize for comparison (lowercase, remove extra spaces)
                    normalized = ' '.join(cleaned.lower().split())
                    if cleaned and normalized not in seen and len(cleaned) > 5:
                        seen.add(normalized)
                        unique_guidelines.append(cleaned)
            
            return unique_guidelines[:15]  # Limit to 15 guidelines
            
        except Exception as e:
            logger.debug(f"Error extracting style guidelines: {e}")
            return []
    
    def _analyze_crawl_result_comprehensive(self, crawl_result: Dict[str, Any]) -> Dict[str, Any]:
        """Comprehensive crawl-result analysis used by the Phase 3 prompt.

        Returns a dict shaped for ``json.dumps``-friendly consumption in
        the LLM prompt. Safe to call with an empty / non-dict input —
        returns an empty dict so the prompt template can fall back to
        "No crawl analysis available" without raising.

        The original implementation lived in an unreleased branch and
        was never merged; calling code (build_research_persona_prompt)
        was, however, already wired up. Without this method the
        scheduled research-persona task crashes with
        ``'ResearchPersonaPromptBuilder' object has no attribute
        '_analyze_crawl_result_comprehensive'`` and the user is blocked
        at onboarding step 4.
        """
        if not isinstance(crawl_result, dict) or not crawl_result:
            return {}

        try:
            topics = self._extract_topics_from_crawl(crawl_result) or []
            keywords = self._extract_keywords_from_crawl(crawl_result) or []
            metadata = (
                crawl_result.get("metadata", {})
                if isinstance(crawl_result.get("metadata"), dict)
                else {}
            )
            analysis: Dict[str, Any] = {
                "content_categories": [],
                "main_topics": topics[:10],
                "main_keywords": keywords[:15],
                "title": metadata.get("title") or crawl_result.get("title") or "",
                "description": metadata.get("description") or crawl_result.get("description") or "",
                "language": metadata.get("language") or crawl_result.get("language") or "",
            }
            # Derive lightweight categories from headings/sections if
            # the upstream crawl didn't already tag them.
            if isinstance(crawl_result.get("headings"), list):
                analysis["heading_count"] = len(crawl_result["headings"])
            if isinstance(crawl_result.get("sections"), list):
                analysis["section_count"] = len(crawl_result["sections"])
                analysis["content_categories"] = [
                    s.get("category")
                    for s in crawl_result["sections"][:10]
                    if isinstance(s, dict) and s.get("category")
                ]
            return analysis
        except Exception as exc:
            logger.debug(f"_analyze_crawl_result_comprehensive failed: {exc}")
            return {}

    def _map_writing_style_comprehensive(
        self,
        writing_style: Dict[str, Any],
        content_characteristics: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Phase 3 writing-style → research-depth mapping.

        Mirrors the prompt's priority order:
        1. writing_style.complexity ("high" / "medium" / "low")
        2. content_characteristics.vocabulary_level
        3. fallback to "medium" (targeted research)

        Returns a dict the prompt template can render; an empty dict
        signals "no style mapping available".
        """
        if not isinstance(writing_style, dict):
            writing_style = {}
        if not isinstance(content_characteristics, dict):
            content_characteristics = {}

        complexity = (writing_style.get("complexity") or "").lower()
        vocabulary_level = (content_characteristics.get("vocabulary_level") or "").lower()

        # Phase 3 priority order from the prompt template.
        if complexity == "high" or vocabulary_level in {"advanced", "high"}:
            research_depth_preference = "comprehensive"
            provider_preference = "exa"
        elif complexity == "low" or vocabulary_level in {"simple", "low", "beginner"}:
            research_depth_preference = "basic"
            provider_preference = "exa"
        else:
            research_depth_preference = "targeted"
            provider_preference = "exa"

        return {
            "research_depth_preference": research_depth_preference,
            "provider_preference": provider_preference,
            "complexity": complexity or "medium",
            "vocabulary_level": vocabulary_level or "medium",
        }

    def _extract_content_themes(
        self,
        crawl_result: Dict[str, Any],
        topics: Optional[List[str]] = None,
    ) -> List[str]:
        """Phase 3 theme extraction for preset generation.

        Combines crawl-derived topics with metadata keywords. Returns
        a deduplicated, normalised list (max 8 themes) for the LLM
        prompt to render into the ``recommended_presets`` section.
        """
        if not isinstance(crawl_result, dict):
            crawl_result = {}
        if not isinstance(topics, list):
            topics = []

        themes: List[str] = []
        seen: set = set()

        for candidate in list(topics) + self._extract_keywords_from_crawl(crawl_result)[:8]:
            if not candidate or not isinstance(candidate, str):
                continue
            cleaned = candidate.strip()
            if not cleaned:
                continue
            key = cleaned.lower()
            if key in seen:
                continue
            seen.add(key)
            themes.append(cleaned)
            if len(themes) >= 8:
                break
        return themes

    def get_json_schema(self) -> Dict[str, Any]:
        """Return JSON schema for structured LLM response."""
        # This will be used with llm_text_gen(json_struct=...)
        from models.research_persona_models import ResearchPersona, ResearchPreset
        
        # Convert Pydantic model to JSON schema
        return ResearchPersona.schema()
