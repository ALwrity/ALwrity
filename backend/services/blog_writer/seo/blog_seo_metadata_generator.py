"""
Blog SEO Metadata Generator

Optimized SEO metadata generation service that uses maximum 2 AI calls
to generate comprehensive metadata including titles, descriptions, 
Open Graph tags, Twitter cards, and structured data.
"""

import asyncio
import re
from datetime import datetime
from typing import Dict, Any, List, Optional
from loguru import logger

from services.llm_providers.main_text_generation import llm_text_gen


class BlogSEOMetadataGenerator:
    """Optimized SEO metadata generator with maximum 2 AI calls"""
    
    def __init__(self):
        """Initialize the metadata generator"""
        logger.info("BlogSEOMetadataGenerator initialized")
    
    async def generate_comprehensive_metadata(
        self, 
        blog_content: str, 
        blog_title: str,
        research_data: Dict[str, Any],
        outline: Optional[List[Dict[str, Any]]] = None,
        seo_analysis: Optional[Dict[str, Any]] = None,
        user_id: str = None
    ) -> Dict[str, Any]:
        """
        Generate comprehensive SEO metadata using maximum 2 AI calls
        
        Args:
            blog_content: The blog content to analyze
            blog_title: The blog title
            research_data: Research data containing keywords and insights
            outline: Outline structure with sections and headings
            seo_analysis: SEO analysis results from previous phase
            user_id: Clerk user ID for subscription checking (required)
            
        Returns:
            Comprehensive metadata including all SEO elements
        """
        if not user_id:
            raise ValueError("user_id is required for subscription checking. Please provide Clerk user ID.")
        try:
            logger.info("Starting comprehensive SEO metadata generation")
            
            # Extract keywords and context from research data
            keywords_data = self._extract_keywords_from_research(research_data)
            logger.info(f"Extracted keywords: {keywords_data}")
            
            # Call 1: Generate core SEO metadata (parallel with Call 2)
            logger.info("Generating core SEO metadata")
            core_metadata_task = self._generate_core_metadata(
                blog_content, blog_title, keywords_data, outline, seo_analysis, user_id=user_id
            )
            
            # Call 2: Generate social media and structured data (parallel with Call 1)
            logger.info("Generating social media and structured data")
            social_metadata_task = self._generate_social_metadata(
                blog_content, blog_title, keywords_data, outline, seo_analysis, user_id=user_id
            )
            
            # Wait for both calls to complete
            core_metadata, social_metadata = await asyncio.gather(
                core_metadata_task,
                social_metadata_task
            )
            
            # Compile final response
            results = self._compile_metadata_response(core_metadata, social_metadata, blog_title)
            
            logger.info(f"SEO metadata generation completed successfully")
            return results
            
        except Exception as e:
            logger.error(f"SEO metadata generation failed: {e}")
            # Fail fast - don't return fallback data
            raise e
    
    def _extract_keywords_from_research(self, research_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract keywords and context from research data, including competitor analysis and content gaps."""
        try:
            keyword_analysis = research_data.get('keyword_analysis', {})
            
            # Handle both 'semantic' and 'semantic_keywords' field names
            semantic_keywords = keyword_analysis.get('semantic', []) or keyword_analysis.get('semantic_keywords', [])
            
            result = {
                'primary_keywords': keyword_analysis.get('primary', []),
                'long_tail_keywords': keyword_analysis.get('long_tail', []),
                'semantic_keywords': semantic_keywords,
                'all_keywords': keyword_analysis.get('all_keywords', []),
                'search_intent': keyword_analysis.get('search_intent', 'informational'),
                'target_audience': research_data.get('target_audience', 'general'),
                'industry': research_data.get('industry', 'general')
            }
            
            # Extract competitor analysis context
            competitor_analysis = research_data.get('competitor_analysis', {})
            if competitor_analysis:
                result['content_gaps'] = competitor_analysis.get('content_gaps', [])
                result['industry_leaders'] = competitor_analysis.get('industry_leaders', [])
                result['opportunities'] = competitor_analysis.get('opportunities', [])
                result['competitive_advantages'] = competitor_analysis.get('competitive_advantages', [])
            else:
                result['content_gaps'] = []
                result['industry_leaders'] = []
                result['opportunities'] = []
                result['competitive_advantages'] = []
            
            # Extract search queries
            search_queries = research_data.get('search_queries', [])
            result['search_queries'] = search_queries if isinstance(search_queries, list) else []
            
            # Extract suggested angles
            suggested_angles = research_data.get('suggested_angles', [])
            result['suggested_angles'] = suggested_angles if isinstance(suggested_angles, list) else []
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to extract keywords from research: {e}")
            return {
                'primary_keywords': [],
                'long_tail_keywords': [],
                'semantic_keywords': [],
                'all_keywords': [],
                'search_intent': 'informational',
                'target_audience': 'general',
                'industry': 'general',
                'content_gaps': [],
                'industry_leaders': [],
                'opportunities': [],
                'competitive_advantages': [],
                'search_queries': [],
                'suggested_angles': []
            }
    
    async def _generate_core_metadata(
        self, 
        blog_content: str, 
        blog_title: str, 
        keywords_data: Dict[str, Any],
        outline: Optional[List[Dict[str, Any]]] = None,
        seo_analysis: Optional[Dict[str, Any]] = None,
        user_id: str = None
    ) -> Dict[str, Any]:
        """Generate core SEO metadata (Call 1)"""
        if not user_id:
            raise ValueError("user_id is required for subscription checking. Please provide Clerk user ID.")
        try:
            # Create comprehensive prompt for core metadata
            prompt = self._create_core_metadata_prompt(
                blog_content, blog_title, keywords_data, outline, seo_analysis
            )
            
            # Define simplified structured schema for core metadata
            schema = {
                "type": "object",
                "properties": {
                    "seo_title": {
                        "type": "string",
                        "description": "SEO-optimized title (50-60 characters)"
                    },
                    "meta_description": {
                        "type": "string", 
                        "description": "Meta description (150-160 characters)"
                    },
                    "url_slug": {
                        "type": "string",
                        "description": "URL slug (lowercase, hyphens)"
                    },
                    "blog_tags": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Blog tags array"
                    },
                    "blog_categories": {
                        "type": "array", 
                        "items": {"type": "string"},
                        "description": "Blog categories array"
                    },
                    "social_hashtags": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Social media hashtags array"
                    },
                    "reading_time": {
                        "type": "integer",
                        "description": "Reading time in minutes"
                    },
                    "focus_keyword": {
                        "type": "string",
                        "description": "Primary focus keyword"
                    }
                },
                "required": ["seo_title", "meta_description", "url_slug", "blog_tags", "blog_categories", "social_hashtags", "reading_time", "focus_keyword"]
            }
            
            # Get structured response using provider-agnostic llm_text_gen
            ai_response_raw = llm_text_gen(
                prompt=prompt,
                json_struct=schema,
                system_prompt=None,
                user_id=user_id  # Pass user_id for subscription checking
            )
            
            # Handle response: llm_text_gen may return dict (from structured JSON) or str (needs parsing)
            ai_response = ai_response_raw
            if isinstance(ai_response_raw, str):
                try:
                    import json
                    ai_response = json.loads(ai_response_raw)
                except json.JSONDecodeError:
                    logger.error(f"Failed to parse JSON response: {ai_response_raw[:200]}...")
                    ai_response = None
            
            # Check if we got a valid response
            if not ai_response or not isinstance(ai_response, dict):
                logger.error("Core metadata generation failed: Invalid response from LLM")
                # Return fallback response using content-derived values
                primary_kw = keywords_data.get('primary_keywords', ['content'])
                primary_kw_first = primary_kw[0] if primary_kw else 'content'
                word_count = len(blog_content.split())
                slug = re.sub(r'[^a-z0-9]+', '-', blog_title.lower())[:50].strip('-')
                return {
                    'seo_title': blog_title,
                    'meta_description': f'Discover insights about {primary_kw_first}. Comprehensive guide with practical tips and expert analysis.',
                    'url_slug': slug,
                    'blog_tags': primary_kw[:5] if isinstance(primary_kw, list) else [primary_kw_first],
                    'blog_categories': [primary_kw_first.title(), 'Guide'],
                    'social_hashtags': [f'#{primary_kw_first.replace(" ", "")}', '#guide', '#tips'],
                    'reading_time': max(1, word_count // 200),
                    'focus_keyword': primary_kw_first
                }
            
            logger.info(f"Core metadata generation completed. Response keys: {list(ai_response.keys())}")
            logger.info(f"Core metadata response: {ai_response}")
            
            return ai_response
            
        except Exception as e:
            logger.error(f"Core metadata generation failed: {e}")
            raise e
    
    async def _generate_social_metadata(
        self, 
        blog_content: str, 
        blog_title: str, 
        keywords_data: Dict[str, Any],
        outline: Optional[List[Dict[str, Any]]] = None,
        seo_analysis: Optional[Dict[str, Any]] = None,
        user_id: str = None
    ) -> Dict[str, Any]:
        """Generate social media and structured data (Call 2)"""
        if not user_id:
            raise ValueError("user_id is required for subscription checking. Please provide Clerk user ID.")
        try:
            # Create comprehensive prompt for social metadata
            prompt = self._create_social_metadata_prompt(
                blog_content, blog_title, keywords_data, outline, seo_analysis
            )
            
            # Define simplified structured schema for social metadata
            schema = {
                "type": "object",
                "properties": {
                    "open_graph": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string"},
                            "description": {"type": "string"},
                            "image": {"type": "string"},
                            "type": {"type": "string"},
                            "site_name": {"type": "string"},
                            "url": {"type": "string"}
                        }
                    },
                    "twitter_card": {
                        "type": "object", 
                        "properties": {
                            "card": {"type": "string"},
                            "title": {"type": "string"},
                            "description": {"type": "string"},
                            "image": {"type": "string"},
                            "site": {"type": "string"},
                            "creator": {"type": "string"}
                        }
                    },
                    "json_ld_schema": {
                        "type": "object",
                        "properties": {
                            "@context": {"type": "string"},
                            "@type": {"type": "string"},
                            "headline": {"type": "string"},
                            "description": {"type": "string"},
                            "author": {"type": "object"},
                            "publisher": {"type": "object"},
                            "datePublished": {"type": "string"},
                            "dateModified": {"type": "string"},
                            "mainEntityOfPage": {"type": "string"},
                            "keywords": {"type": "array"},
                            "wordCount": {"type": "integer"}
                        }
                    }
                },
                "required": ["open_graph", "twitter_card", "json_ld_schema"]
            }
            
            # Get structured response using provider-agnostic llm_text_gen
            ai_response_raw = llm_text_gen(
                prompt=prompt,
                json_struct=schema,
                system_prompt=None,
                user_id=user_id  # Pass user_id for subscription checking
            )
            
            # Handle response: llm_text_gen may return dict (from structured JSON) or str (needs parsing)
            ai_response = ai_response_raw
            if isinstance(ai_response_raw, str):
                try:
                    import json
                    ai_response = json.loads(ai_response_raw)
                except json.JSONDecodeError:
                    logger.error(f"Failed to parse JSON response: {ai_response_raw[:200]}...")
                    ai_response = None
            
            # Check if we got a valid response
            if not ai_response or not isinstance(ai_response, dict) or not ai_response.get('open_graph') or not ai_response.get('twitter_card') or not ai_response.get('json_ld_schema'):
                logger.error("Social metadata generation failed: Invalid or empty response from LLM")
                # Return fallback response using content-derived values
                primary_kw = keywords_data.get('primary_keywords', ['content'])
                primary_kw_first = primary_kw[0] if primary_kw else 'content'
                slug = re.sub(r'[^a-z0-9]+', '-', blog_title.lower())[:50].strip('-')
                word_count = len(blog_content.split())
                current_date = datetime.now().isoformat()
                return {
                    'open_graph': {
                        'title': blog_title,
                        'description': f'Discover insights about {primary_kw_first}. Comprehensive guide with practical tips.',
                        'image': '',
                        'type': 'article',
                        'site_name': '',
                        'url': f'https://example.com/blog/{slug}'
                    },
                    'twitter_card': {
                        'card': 'summary_large_image',
                        'title': blog_title,
                        'description': f'Explore our guide on {primary_kw_first}.',
                        'image': '',
                        'site': '',
                        'creator': ''
                    },
                    'json_ld_schema': {
                        '@context': 'https://schema.org',
                        '@type': 'Article',
                        'headline': blog_title,
                        'description': f'Comprehensive guide about {primary_kw_first}.',
                        'author': {'@type': 'Person', 'name': ''},
                        'publisher': {'@type': 'Organization', 'name': ''},
                        'datePublished': current_date,
                        'dateModified': current_date,
                        'mainEntityOfPage': f'https://example.com/blog/{slug}',
                        'keywords': primary_kw[:5] if isinstance(primary_kw, list) else [primary_kw_first],
                        'wordCount': word_count
                    }
                }
            
            logger.info(f"Social metadata generation completed. Response keys: {list(ai_response.keys())}")
            logger.info(f"Open Graph data: {ai_response.get('open_graph', 'Not found')}")
            logger.info(f"Twitter Card data: {ai_response.get('twitter_card', 'Not found')}")
            logger.info(f"JSON-LD data: {ai_response.get('json_ld_schema', 'Not found')}")
            
            return ai_response
            
        except Exception as e:
            logger.error(f"Social metadata generation failed: {e}")
            raise e
    
    def _extract_content_highlights(self, blog_content: str, max_length: int = 2500) -> str:
        """Extract key sections from blog content for prompt context"""
        try:
            lines = blog_content.split('\n')
            
            # Get first paragraph (introduction)
            intro = ""
            for line in lines[:20]:
                if line.strip() and not line.strip().startswith('#'):
                    intro += line.strip() + " "
                    if len(intro) > 300:
                        break
            
            # Get section headings
            headings = [line.strip() for line in lines if line.strip().startswith('##')][:6]
            
            # Get conclusion if available
            conclusion = ""
            for line in reversed(lines[-20:]):
                if line.strip() and not line.strip().startswith('#'):
                    conclusion = line.strip() + " " + conclusion
                    if len(conclusion) > 300:
                        break
            
            highlights = f"INTRODUCTION: {intro[:300]}...\n\n"
            highlights += f"SECTION HEADINGS: {' | '.join([h.replace('##', '').strip() for h in headings])}\n\n"
            if conclusion:
                highlights += f"CONCLUSION: {conclusion[:300]}..."
            
            return highlights[:max_length]
        except Exception as e:
            logger.warning(f"Failed to extract content highlights: {e}")
            return blog_content[:2000] + "..."
    
    def _create_core_metadata_prompt(
        self, 
        blog_content: str, 
        blog_title: str, 
        keywords_data: Dict[str, Any],
        outline: Optional[List[Dict[str, Any]]] = None,
        seo_analysis: Optional[Dict[str, Any]] = None
    ) -> str:
        """Create high-quality prompt for core metadata generation"""
        
        primary_keywords = ", ".join(keywords_data.get('primary_keywords', []))
        semantic_keywords = ", ".join(keywords_data.get('semantic_keywords', []))
        search_intent = keywords_data.get('search_intent', 'informational')
        target_audience = keywords_data.get('target_audience', 'general')
        industry = keywords_data.get('industry', 'general')
        word_count = len(blog_content.split())
        
        # Extract outline structure
        outline_context = ""
        if outline:
            headings = [s.get('heading', '') for s in outline if s.get('heading')]
            outline_context = f"""
OUTLINE STRUCTURE:
- Total sections: {len(outline)}
- Section headings: {', '.join(headings[:8])}
- Content hierarchy: Well-structured with {len(outline)} main sections
"""
        
        # Extract SEO analysis insights with weakness-aware guidance
        seo_context = ""
        if seo_analysis:
            overall_score = seo_analysis.get('overall_score', seo_analysis.get('seo_score', 0))
            category_scores = seo_analysis.get('category_scores', {})
            applied_recs = seo_analysis.get('applied_recommendations') or []
            
            # Build weakness-specific guidance for metadata
            weakness_guidance = []
            kw_score = category_scores.get('keywords', category_scores.get('Keywords', 0))
            if kw_score < 70:
                weakness_guidance.append("Keyword optimization is weak — ensure title and description prominently feature primary keywords")
            read_score = category_scores.get('readability', category_scores.get('Readability', 0))
            if read_score < 70:
                weakness_guidance.append("Readability needs improvement — use clear, accessible language in the meta description")
            struct_score = category_scores.get('structure', category_scores.get('Structure', 0))
            if struct_score < 70:
                weakness_guidance.append("Content structure needs improvement — the title should clearly signal the content structure")
            
            seo_context = f"""
SEO ANALYSIS RESULTS:
- Overall SEO Score: {overall_score}/100
- Category Scores: Structure {struct_score}, Keywords {kw_score}, Readability {read_score}
- Applied Recommendations: {len(applied_recs)} SEO optimizations have been applied
- Content Quality: Optimized for search engines with keyword focus
{f"- WEAKNESS GUIDANCE: {'; '.join(weakness_guidance)}" if weakness_guidance else ""}
"""
        
        # Build research context block
        research_block = ""
        content_gaps = keywords_data.get('content_gaps', [])
        competitive_advantages = keywords_data.get('competitive_advantages', [])
        search_queries = keywords_data.get('search_queries', [])
        suggested_angles = keywords_data.get('suggested_angles', [])
        industry_leaders = keywords_data.get('industry_leaders', [])
        
        if content_gaps:
            research_block += f"\nCONTENT GAPS (from competitor analysis): {', '.join(content_gaps[:5])}"
        if competitive_advantages:
            research_block += f"\nOUR KEY DIFFERENTIATORS: {', '.join(competitive_advantages[:3])}"
        if search_queries:
            research_block += f"\nORIGINAL SEARCH QUERIES: {', '.join(search_queries[:5])}"
        if suggested_angles:
            research_block += f"\nCONTENT ANGLES: {', '.join(suggested_angles[:3])}"
        if industry_leaders:
            research_block += f"\nINDUSTRY LEADERS: {', '.join(industry_leaders[:3])}"
        
        # Get more content context (key sections instead of just first 1000 chars)
        content_preview = self._extract_content_highlights(blog_content)
        
        # PHASE C SKIP (persona voice): SEO metadata (title/description) is search-
        # engine-driven (keywords, click-through), not brand voice. Style/topic separation.
        prompt = f"""
Generate comprehensive, personalized SEO metadata for this blog post. 

=== BLOG CONTENT CONTEXT ===
TITLE: {blog_title}
CONTENT PREVIEW (key sections): {content_preview}
WORD COUNT: {word_count} words
READING TIME ESTIMATE: {max(1, word_count // 200)} minutes

{outline_context}

=== KEYWORD & AUDIENCE DATA ===
PRIMARY KEYWORDS: {primary_keywords}
SEMANTIC KEYWORDS: {semantic_keywords}
SEARCH INTENT: {search_intent}
TARGET AUDIENCE: {target_audience}
INDUSTRY: {industry}
{research_block}

{seo_context}

=== METADATA GENERATION REQUIREMENTS ===
1. SEO TITLE (50-60 characters, must include primary keyword):
   - Front-load primary keyword
   - Make it compelling and click-worthy
   - Include power words if appropriate for {target_audience} audience
   - Optimized for {search_intent} search intent

2. META DESCRIPTION (150-160 characters, must include CTA):
   - Include primary keyword naturally in first 120 chars
   - Add compelling call-to-action (e.g., "Learn more", "Discover how", "Get started")
   - Highlight value proposition for {target_audience} audience
   - Use {industry} industry-specific terminology where relevant

3. URL SLUG (lowercase, hyphens, 3-5 words):
   - Include primary keyword
   - Remove stop words
   - Keep it concise and readable

4. BLOG TAGS (5-8 relevant tags):
   - Mix of primary, semantic, and long-tail keywords
   - Industry-specific tags for {industry}
   - Audience-relevant tags for {target_audience}

5. BLOG CATEGORIES (2-3 categories):
   - Based on content structure and {industry} industry standards
   - Reflect main themes from outline sections

6. SOCIAL HASHTAGS (5-10 hashtags with #):
   - Include primary keyword as hashtag
   - Industry-specific hashtags for {industry}
   - Trending/relevant hashtags for {target_audience}

7. READING TIME (calculate from {word_count} words):
   - Average reading speed: 200 words/minute
   - Round to nearest minute

8. FOCUS KEYWORD (primary keyword for SEO):
   - Select the most important primary keyword
   - Should match the main topic and search intent

=== QUALITY REQUIREMENTS ===
- All metadata must be unique, not generic
- Incorporate insights from SEO analysis if provided
- Reflect the actual content structure from outline
- Use language appropriate for {target_audience} audience
- Optimize for {search_intent} search intent
- Make descriptions compelling and action-oriented
- Metadata should reflect current context (you are generating for {datetime.now().year}), but avoid stating the year unless the content itself is year-specific

Generate metadata that is personalized, compelling, and SEO-optimized.
"""
        return prompt
    
    def _create_social_metadata_prompt(
        self, 
        blog_content: str, 
        blog_title: str, 
        keywords_data: Dict[str, Any],
        outline: Optional[List[Dict[str, Any]]] = None,
        seo_analysis: Optional[Dict[str, Any]] = None
    ) -> str:
        """Create high-quality prompt for social metadata generation"""
        
        primary_keywords = ", ".join(keywords_data.get('primary_keywords', []))
        search_intent = keywords_data.get('search_intent', 'informational')
        target_audience = keywords_data.get('target_audience', 'general')
        industry = keywords_data.get('industry', 'general')
        current_date = datetime.now().isoformat()
        
        # Add outline and SEO context similar to core metadata prompt
        outline_context = ""
        if outline:
            headings = [s.get('heading', '') for s in outline if s.get('heading')]
            outline_context = f"\nOUTLINE SECTIONS: {', '.join(headings[:6])}\n"
        
        seo_context = ""
        if seo_analysis:
            overall_score = seo_analysis.get('overall_score', seo_analysis.get('seo_score', 0))
            seo_context = f"\nSEO SCORE: {overall_score}/100 (optimized content)\n"
        
        # Build research context for social metadata
        research_block = ""
        content_gaps = keywords_data.get('content_gaps', [])
        competitive_advantages = keywords_data.get('competitive_advantages', [])
        search_queries = keywords_data.get('search_queries', [])
        if content_gaps:
            research_block += f"\nCONTENT GAPS: {', '.join(content_gaps[:3])}"
        if competitive_advantages:
            research_block += f"\nDIFFERENTIATORS: {', '.join(competitive_advantages[:3])}"
        if search_queries:
            research_block += f"\nSEARCH QUERIES: {', '.join(search_queries[:4])}"
        
        content_preview = self._extract_content_highlights(blog_content, 1500)
        
        prompt = f"""
Generate engaging social media metadata for this blog post.

=== CONTENT ===
TITLE: {blog_title}
CONTENT: {content_preview}
{outline_context}
{seo_context}
KEYWORDS: {primary_keywords}
TARGET AUDIENCE: {target_audience}
INDUSTRY: {industry}
CURRENT DATE: {current_date}
{research_block}

=== GENERATION REQUIREMENTS ===

1. OPEN GRAPH (Facebook/LinkedIn):
   - title: 60 chars max, include primary keyword, compelling for {target_audience}
   - description: 160 chars max, include CTA and value proposition
   - image: Suggest an appropriate image URL (placeholder if none available)
   - type: "article"
   - site_name: Use appropriate site name for {industry} industry
   - url: Generate canonical URL structure

2. TWITTER CARD:
    - card: "summary_large_image"
    - title: 70 chars max, optimized for Twitter audience
    - description: 200 chars max with relevant hashtags inline
    - image: Match Open Graph image
    - site: Leave empty string (user will add their Twitter handle)
    - creator: Leave empty string (user will add author Twitter handle)

3. JSON-LD SCHEMA (Article):
    - @context: "https://schema.org"
    - @type: "Article"
    - headline: Article title (optimized)
    - description: Article description (150-200 chars)
    - author: {{"@type": "Person", "name": ""}} (leave empty, user will add author name)
    - publisher: {{"@type": "Organization", "name": ""}} (leave empty, user will add site name)
   - datePublished: {current_date}
   - dateModified: {current_date}
   - mainEntityOfPage: {{"@type": "WebPage", "@id": "canonical-url"}}
   - keywords: Array of primary and semantic keywords
   - wordCount: {len(blog_content.split())}
   - articleSection: Primary category based on content
   - inLanguage: "en-US"

Make it engaging, personalized for {target_audience}, and optimized for {industry} industry.
"""
        return prompt
    
    def _compile_metadata_response(
        self, 
        core_metadata: Dict[str, Any], 
        social_metadata: Dict[str, Any],
        original_title: str
    ) -> Dict[str, Any]:
        """Compile final metadata response"""
        try:
            # Extract data from AI responses
            seo_title = core_metadata.get('seo_title', original_title)
            meta_description = core_metadata.get('meta_description', '')
            url_slug = core_metadata.get('url_slug', '')
            blog_tags = core_metadata.get('blog_tags', [])
            blog_categories = core_metadata.get('blog_categories', [])
            social_hashtags = core_metadata.get('social_hashtags', [])
            canonical_url = core_metadata.get('canonical_url', '')
            reading_time = core_metadata.get('reading_time', 0)
            focus_keyword = core_metadata.get('focus_keyword', '')
            
            open_graph = social_metadata.get('open_graph', {})
            twitter_card = social_metadata.get('twitter_card', {})
            json_ld_schema = social_metadata.get('json_ld_schema', {})
            
            # Compile comprehensive response
            response = {
                'success': True,
                'title_options': [seo_title],  # For backward compatibility
                'meta_descriptions': [meta_description],  # For backward compatibility
                'seo_title': seo_title,
                'meta_description': meta_description,
                'url_slug': url_slug,
                'blog_tags': blog_tags,
                'blog_categories': blog_categories,
                'social_hashtags': social_hashtags,
                'canonical_url': canonical_url,
                'reading_time': reading_time,
                'focus_keyword': focus_keyword,
                'open_graph': open_graph,
                'twitter_card': twitter_card,
                'json_ld_schema': json_ld_schema,
                'generated_at': datetime.utcnow().isoformat(),
                'metadata_summary': {
                    'total_metadata_types': 10,
                    'ai_calls_used': 2,
                    'optimization_score': self._calculate_optimization_score(core_metadata, social_metadata)
                }
            }
            
            logger.info(f"Metadata compilation completed. Generated {len(response)} metadata fields")
            return response
            
        except Exception as e:
            logger.error(f"Metadata compilation failed: {e}")
            raise e
    
    def _calculate_optimization_score(self, core_metadata: Dict[str, Any], social_metadata: Dict[str, Any]) -> int:
        """Calculate metadata quality score based on content relevance and adherence to best practices.
        
        Unlike the old completeness-based score (which just checked field existence),
        this assigns quality-weighted points based on how well each field is optimized.
        """
        try:
            score = 0
            
            # Title quality (0-15): Length in 50-60 chars is optimal
            seo_title = core_metadata.get('seo_title', '')
            if seo_title:
                title_len = len(seo_title)
                if 50 <= title_len <= 60:
                    score += 15
                elif 40 <= title_len <= 70:
                    score += 10
                elif title_len > 0:
                    score += 5
            
            # Meta description quality (0-15): Length in 150-160 chars is optimal, has CTA
            meta_desc = core_metadata.get('meta_description', '')
            if meta_desc:
                desc_len = len(meta_desc)
                desc_lower = meta_desc.lower()
                has_cta = any(phrase in desc_lower for phrase in ['learn', 'discover', 'find', 'get', 'explore', 'how to', 'why', 'tips', 'guide', 'try', 'start'])
                if 150 <= desc_len <= 160 and has_cta:
                    score += 15
                elif 120 <= desc_len <= 170:
                    score += 10 if has_cta else 7
                elif desc_len > 0:
                    score += 4
            
            # URL slug quality (0-10): Short, keyword-rich, no stop words
            url_slug = core_metadata.get('url_slug', '')
            if url_slug:
                slug_parts = url_slug.strip('/').split('/')
                slug_words = slug_parts[-1].split('-') if slug_parts else []
                if 2 <= len(slug_words) <= 5:
                    score += 10
                elif len(slug_words) > 0:
                    score += 5
            
            # Tags and categories quality (0-20)
            blog_tags = core_metadata.get('blog_tags', [])
            blog_categories = core_metadata.get('blog_categories', [])
            if blog_tags and len(blog_tags) >= 3:
                score += 10
            elif blog_tags:
                score += 5
            if blog_categories and len(blog_categories) >= 1:
                score += 10
            elif blog_categories:
                score += 5
            
            # Social hashtags (0-10): Relevant and non-spammy
            social_hashtags = core_metadata.get('social_hashtags', [])
            if social_hashtags and 3 <= len(social_hashtags) <= 8:
                score += 10
            elif social_hashtags:
                score += 5
            
            # Focus keyword (0-10): Present and relevant
            focus_keyword = core_metadata.get('focus_keyword', '')
            if focus_keyword and seo_title and focus_keyword.lower() in seo_title.lower():
                score += 10
            elif focus_keyword:
                score += 4
            
            # Open Graph quality (0-10): Has title, description, correct type
            og = social_metadata.get('open_graph', {})
            if og:
                og_score = 0
                if og.get('title') and len(og.get('title', '')) > 10:
                    og_score += 4
                if og.get('description') and 100 <= len(og.get('description', '')) <= 200:
                    og_score += 4
                if og.get('type') == 'article':
                    og_score += 2
                score += og_score
            
            # Twitter Card quality (0-5)
            twitter = social_metadata.get('twitter_card', {})
            if twitter:
                tw_score = 0
                if twitter.get('title') and len(twitter.get('title', '')) > 10:
                    tw_score += 3
                if twitter.get('card') == 'summary_large_image':
                    tw_score += 2
                score += tw_score
            
            # JSON-LD quality (0-5): Has headline, description, datePublished
            json_ld = social_metadata.get('json_ld_schema', {})
            if json_ld:
                jl_score = 0
                if json_ld.get('headline'):
                    jl_score += 2
                if json_ld.get('description'):
                    jl_score += 2
                if json_ld.get('datePublished'):
                    jl_score += 1
                score += jl_score
            
            return min(score, 100)
            
        except Exception as e:
            logger.error(f"Failed to calculate optimization score: {e}")
            return 0
