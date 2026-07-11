"""
Blog Content SEO Analyzer

Specialized SEO analyzer for blog content with parallel processing.
Leverages existing non-AI SEO tools and uses single AI prompt for structured analysis.
"""

import asyncio
import math
import re
import textstat
from datetime import datetime
from typing import Dict, Any, List, Optional
from utils.logger_utils import get_service_logger

# Service-specific logger
logger = get_service_logger("blog_content_seo_analyzer")

from services.seo_analyzer import (
    ContentAnalyzer, KeywordAnalyzer, 
    URLStructureAnalyzer, AIInsightGenerator
)
from services.llm_providers.main_text_generation import llm_text_gen


class BlogContentSEOAnalyzer:
    """Specialized SEO analyzer for blog content with parallel processing"""
    
    def __init__(self):
        """Initialize the blog content SEO analyzer"""
        self.content_analyzer = ContentAnalyzer()
        self.keyword_analyzer = KeywordAnalyzer()
        self.url_analyzer = URLStructureAnalyzer()
        self.ai_insights = AIInsightGenerator()
        
        logger.info("BlogContentSEOAnalyzer initialized")
    
    async def analyze_blog_content(self, blog_content: str, research_data: Dict[str, Any], blog_title: Optional[str] = None, user_id: str = None, outline: Optional[List[Dict[str, Any]]] = None, competitive_advantage: Optional[str] = None) -> Dict[str, Any]:
        """
        Main analysis method with parallel processing
        
        Args:
            blog_content: The blog content to analyze
            research_data: Research data containing keywords and other insights
            blog_title: Optional blog title
            user_id: Clerk user ID for subscription checking (required)
            outline: Optional outline sections for context-aware analysis
            competitive_advantage: Optional competitive advantage for context
            
        Returns:
            Comprehensive SEO analysis results
        """
        if not user_id:
            raise ValueError("user_id is required for subscription checking. Please provide Clerk user ID.")
        try:
            logger.info("Starting blog content SEO analysis")
            
            # Extract research context (keywords + competitor data + search queries)
            research_context = self._extract_research_context(research_data)
            logger.info(f"Extracted research context with {len(research_context.get('primary', []))} primary keywords")
            
            # Phase 1: Run non-AI analyzers in parallel
            logger.info("Running non-AI analyzers in parallel")
            non_ai_results = await self._run_non_ai_analyzers(blog_content, research_context)
            
            # Phase 2: Single AI analysis for structured insights (with outline + competitive context)
            logger.info("Running AI analysis")
            ai_insights = await self._run_ai_analysis(
                blog_content, research_context, non_ai_results, user_id=user_id,
                outline=outline, competitive_advantage=competitive_advantage
            )
            
            # Phase 3: Compile and format results
            logger.info("Compiling results")
            results = self._compile_blog_seo_results(non_ai_results, ai_insights, research_context)
            
            logger.info(f"SEO analysis completed. Overall score: {results.get('overall_score', 0)}")
            return results
            
        except Exception as e:
            logger.error(f"Blog SEO analysis failed: {e}")
            # Fail fast - don't return fallback data
            raise e
    
    def _extract_research_context(self, research_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract research context from research data including keywords, competitor data, and search queries.
        
        Previously only extracted keyword_analysis. Now also extracts:
        - competitor_analysis (content_gaps, industry_leaders, opportunities, competitive_advantages)
        - search_queries
        - suggested_angles
        """
        try:
            logger.info(f"Extracting research context from research data")
            
            # Extract keywords from research data structure
            keyword_analysis = research_data.get('keyword_analysis', {})
            
            # Handle different possible structures
            primary_keywords = []
            long_tail_keywords = []
            semantic_keywords = []
            all_keywords = []
            
            # Try to extract primary keywords from different possible locations
            if 'primary' in keyword_analysis:
                primary_keywords = keyword_analysis.get('primary', [])
            elif 'keywords' in research_data:
                # Fallback to top-level keywords
                primary_keywords = research_data.get('keywords', [])
            
            # Extract other keyword types
            long_tail_keywords = keyword_analysis.get('long_tail', [])
            # Handle both 'semantic' and 'semantic_keywords' field names
            semantic_keywords = keyword_analysis.get('semantic', []) or keyword_analysis.get('semantic_keywords', [])
            all_keywords = keyword_analysis.get('all_keywords', primary_keywords)
            
            result = {
                'primary': primary_keywords,
                'long_tail': long_tail_keywords,
                'semantic': semantic_keywords,
                'all_keywords': all_keywords,
                'search_intent': keyword_analysis.get('search_intent', 'informational'),
            }
            
            # Extract competitor analysis
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
            
            logger.info(f"Extracted research context: {len(primary_keywords)} primary keywords, {len(result.get('content_gaps', []))} content gaps, {len(result.get('search_queries', []))} search queries")
            return result
            
        except Exception as e:
            logger.error(f"Failed to extract research context from research data: {e}")
            logger.error(f"Research data structure: {research_data}")
            raise ValueError(f"Research context extraction failed: {e}")
    
    async def _run_non_ai_analyzers(self, blog_content: str, keywords_data: Dict[str, Any]) -> Dict[str, Any]:
        """Run all non-AI analyzers in parallel for maximum performance"""
        
        logger.info(f"Starting non-AI analyzers with content length: {len(blog_content)} chars")
        logger.info(f"Keywords data: {keywords_data}")
        
        # Parallel execution of fast analyzers
        tasks = [
            self._analyze_content_structure(blog_content),
            self._analyze_keyword_usage(blog_content, keywords_data),
            self._analyze_readability(blog_content),
            self._analyze_content_quality(blog_content),
            self._analyze_heading_structure(blog_content)
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Check for exceptions and fail fast
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                task_names = ['content_structure', 'keyword_analysis', 'readability_analysis', 'content_quality', 'heading_structure']
                logger.error(f"Task {task_names[i]} failed: {result}")
                raise result
        
        # Log successful results
        task_names = ['content_structure', 'keyword_analysis', 'readability_analysis', 'content_quality', 'heading_structure']
        for i, (name, result) in enumerate(zip(task_names, results)):
            logger.info(f"✅ {name} completed: {type(result).__name__} with {len(result) if isinstance(result, dict) else 'N/A'} fields")
        
        return {
            'content_structure': results[0],
            'keyword_analysis': results[1],
            'readability_analysis': results[2],
            'content_quality': results[3],
            'heading_structure': results[4]
        }
    
    async def _analyze_content_structure(self, content: str) -> Dict[str, Any]:
        """Analyze blog content structure"""
        try:
            # Parse markdown content
            lines = content.split('\n')
            
            # Count sections, paragraphs, sentences
            sections = len([line for line in lines if line.startswith('##')])
            paragraphs = len([line for line in lines if line.strip() and not line.startswith('#')])
            sentences = len(re.findall(r'[.!?]+', content))
            
            # Blog-specific structure analysis
            content_lower = content.lower()
            first_500 = content_lower[:500] if len(content) > 500 else content_lower
            last_500 = content_lower[-500:] if len(content) > 500 else content_lower
            has_introduction = any('introduction' in line.lower() or 'overview' in line.lower()
                                   for line in lines[:10]) or any(
                phrase in first_500 for phrase in [
                    'in this', 'this article', 'this guide', 'this post',
                    'we will', "you'll learn", "let's explore", "whether you're",
                    'in this section', 'this blog post', 'here we', 'today we',
                    "we'll explore", "we'll cover", "we'll dive"
                ])
            has_conclusion = any('conclusion' in line.lower() or 'summary' in line.lower()
                                 for line in lines[-10:]) or any(
                phrase in last_500 for phrase in [
                    'in conclusion', 'to summarize', 'in summary', 'bottom line',
                    'key takeaways', 'remember that', "as we've seen", 'wrapping up',
                    'final thoughts', 'to conclude', 'in short', 'overall'
                ])
            has_cta = any('call to action' in line.lower() or 'learn more' in line.lower() 
                          for line in lines)
            
            structure_score = self._calculate_structure_score(sections, paragraphs, has_introduction, has_conclusion)
            
            return {
                'total_sections': sections,
                'total_paragraphs': paragraphs,
                'total_sentences': sentences,
                'has_introduction': has_introduction,
                'has_conclusion': has_conclusion,
                'has_call_to_action': has_cta,
                'structure_score': structure_score,
                'recommendations': self._get_structure_recommendations(sections, has_introduction, has_conclusion, content)
            }
        except Exception as e:
            logger.error(f"Content structure analysis failed: {e}")
            raise e
    
    async def _analyze_keyword_usage(self, content: str, keywords_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze keyword usage and optimization"""
        try:
            # Extract keywords from research data
            primary_keywords = keywords_data.get('primary', [])
            long_tail_keywords = keywords_data.get('long_tail', [])
            semantic_keywords = keywords_data.get('semantic', [])
            
            # Use existing KeywordAnalyzer
            keyword_result = self.keyword_analyzer.analyze(content, primary_keywords)
            
            # Blog-specific keyword analysis
            keyword_analysis = {
                'primary_keywords': primary_keywords,
                'long_tail_keywords': long_tail_keywords,
                'semantic_keywords': semantic_keywords,
                'keyword_density': {},
                'keyword_distribution': {},
                'missing_keywords': [],
                'over_optimization': [],
                'recommendations': []
            }
            
            # Analyze each keyword type
            for keyword in primary_keywords:
                density = self._calculate_keyword_density(content, keyword)
                keyword_analysis['keyword_density'][keyword] = density
                
                # Check if keyword appears in headings
                in_headings = self._keyword_in_headings(content, keyword)
                keyword_analysis['keyword_distribution'][keyword] = {
                    'density': density,
                    'in_headings': in_headings,
                    'first_occurrence': content.lower().find(keyword.lower())
                }
            
            # Check for missing important keywords
            for keyword in primary_keywords:
                if keyword.lower() not in content.lower():
                    keyword_analysis['missing_keywords'].append(keyword)
            
            # Check for over-optimization
            for keyword, density in keyword_analysis['keyword_density'].items():
                if density > 3.0:  # Over 3% density
                    keyword_analysis['over_optimization'].append(keyword)
            
            return keyword_analysis
        except Exception as e:
            logger.error(f"Keyword analysis failed: {e}")
            raise e
    
    async def _analyze_readability(self, content: str) -> Dict[str, Any]:
        """Analyze content readability using textstat integration"""
        try:
            # Calculate readability metrics
            readability_metrics = {
                'flesch_reading_ease': textstat.flesch_reading_ease(content),
                'flesch_kincaid_grade': textstat.flesch_kincaid_grade(content),
                'gunning_fog': textstat.gunning_fog(content),
                'smog_index': textstat.smog_index(content),
                'automated_readability': textstat.automated_readability_index(content),
                'coleman_liau': textstat.coleman_liau_index(content)
            }
            
            # Blog-specific readability analysis
            avg_sentence_length = self._calculate_avg_sentence_length(content)
            avg_paragraph_length = self._calculate_avg_paragraph_length(content)
            
            readability_score = self._calculate_readability_score(readability_metrics)
            
            return {
                'metrics': readability_metrics,
                'avg_sentence_length': avg_sentence_length,
                'avg_paragraph_length': avg_paragraph_length,
                'readability_score': readability_score,
                'target_audience': self._determine_target_audience(readability_metrics),
                'recommendations': self._get_readability_recommendations(readability_metrics, avg_sentence_length)
            }
        except Exception as e:
            logger.error(f"Readability analysis failed: {e}")
            raise e
    
    async def _analyze_content_quality(self, content: str) -> Dict[str, Any]:
        """Analyze overall content quality"""
        try:
            # Word count analysis
            words = content.split()
            word_count = len(words)
            
            # Content depth analysis
            unique_words = len(set(word.lower() for word in words))
            vocabulary_diversity = unique_words / word_count if word_count > 0 else 0
            
            # Content flow analysis
            transition_words = ['however', 'therefore', 'furthermore', 'moreover', 'additionally', 'consequently']
            transition_count = sum(content.lower().count(word) for word in transition_words)
            
            content_depth_score = self._calculate_content_depth_score(word_count, vocabulary_diversity)
            flow_score = self._calculate_flow_score(transition_count, word_count)
            
            return {
                'word_count': word_count,
                'unique_words': unique_words,
                'vocabulary_diversity': vocabulary_diversity,
                'transition_words_used': transition_count,
                'content_depth_score': content_depth_score,
                'flow_score': flow_score,
                'recommendations': self._get_content_quality_recommendations(word_count, vocabulary_diversity, transition_count)
            }
        except Exception as e:
            logger.error(f"Content quality analysis failed: {e}")
            raise e
    
    async def _analyze_heading_structure(self, content: str) -> Dict[str, Any]:
        """Analyze heading structure and hierarchy"""
        try:
            # Extract headings
            h1_headings = re.findall(r'^# (.+)$', content, re.MULTILINE)
            h2_headings = re.findall(r'^## (.+)$', content, re.MULTILINE)
            h3_headings = re.findall(r'^### (.+)$', content, re.MULTILINE)
            
            # Analyze heading structure
            heading_hierarchy_score = self._calculate_heading_hierarchy_score(h1_headings, h2_headings, h3_headings)
            
            return {
                'h1_count': len(h1_headings),
                'h2_count': len(h2_headings),
                'h3_count': len(h3_headings),
                'h1_headings': h1_headings,
                'h2_headings': h2_headings,
                'h3_headings': h3_headings,
                'heading_hierarchy_score': heading_hierarchy_score,
                'recommendations': self._get_heading_recommendations(h1_headings, h2_headings, h3_headings)
            }
        except Exception as e:
            logger.error(f"Heading structure analysis failed: {e}")
            raise e
    
    # Helper methods for calculations and scoring

    @staticmethod
    def _sigmoid(x: float, midpoint: float = 0.0, steepness: float = 1.0) -> float:
        """Sigmoid function for smooth scoring curves. Returns 0-1."""
        try:
            return 1.0 / (1.0 + math.exp(-steepness * (x - midpoint)))
        except OverflowError:
            return 0.0 if x < midpoint else 1.0

    def _calculate_structure_score(self, sections: int, paragraphs: int, has_intro: bool, has_conclusion: bool) -> int:
        """Calculate content structure score using continuous curves instead of rigid brackets.

        Sections: optimal around 5, steep penalties below 3 or above 10.
        Paragraphs: optimal around 12, steep penalties below 5 or above 25.
        Intro/conclusion: binary bonuses.
        """
        # Section score: peaks around 4-6, decays smoothly for low or high counts
        section_score = self._sigmoid(sections, midpoint=4, steepness=0.8) * 40
        if sections > 8:
            section_score = max(section_score * 0.7, 10)

        # Paragraph score: peaks around 12, decays for low or high counts
        para_score = self._sigmoid(paragraphs, midpoint=10, steepness=0.3) * 40
        if paragraphs > 25:
            para_score = max(para_score * 0.6, 8)

        intro_score = 10 if has_intro else 0
        conclusion_score = 10 if has_conclusion else 0

        return int(min(max(section_score + para_score + intro_score + conclusion_score, 5), 100))
    
    def _calculate_keyword_density(self, content: str, keyword: str) -> float:
        """Calculate keyword density percentage"""
        content_lower = content.lower()
        keyword_lower = keyword.lower()
        
        word_count = len(content.split())
        keyword_count = content_lower.count(keyword_lower)
        
        return (keyword_count / word_count * 100) if word_count > 0 else 0
    
    def _keyword_in_headings(self, content: str, keyword: str) -> bool:
        """Check if keyword appears in headings"""
        headings = re.findall(r'^#+ (.+)$', content, re.MULTILINE)
        return any(keyword.lower() in heading.lower() for heading in headings)
    
    def _calculate_avg_sentence_length(self, content: str) -> float:
        """Calculate average sentence length"""
        sentences = re.split(r'[.!?]+', content)
        sentences = [s.strip() for s in sentences if s.strip()]
        
        if not sentences:
            return 0
        
        total_words = sum(len(sentence.split()) for sentence in sentences)
        return total_words / len(sentences)
    
    def _calculate_avg_paragraph_length(self, content: str) -> float:
        """Calculate average paragraph length"""
        paragraphs = [p.strip() for p in content.split('\n\n') if p.strip()]
        
        if not paragraphs:
            return 0
        
        total_words = sum(len(paragraph.split()) for paragraph in paragraphs)
        return total_words / len(paragraphs)
    
    def _calculate_readability_score(self, metrics: Dict[str, float]) -> int:
        """Calculate readability score using a continuous sigmoid curve on Flesch Reading Ease.

        Maps Flesch 0-100 to a score that:
        - Below 30: 25-45 (hard to read)
        - 30-50: 45-65 (moderate)
        - 50-70: 65-85 (good range)
        - 70-90: 85-95 (excellent)
        - Above 90: 95-100 (very easy)
        """
        flesch = metrics.get('flesch_reading_ease', 0)
        score = self._sigmoid(flesch, midpoint=50, steepness=0.06) * 70 + 25
        if flesch > 80:
            score = min(score + 5, 100)
        return int(min(max(score, 20), 100))
    
    def _determine_target_audience(self, metrics: Dict[str, float]) -> str:
        """Determine target audience based on readability metrics"""
        flesch_score = metrics.get('flesch_reading_ease', 0)
        
        if flesch_score >= 80:
            return "General audience (8th grade level)"
        elif flesch_score >= 60:
            return "High school level"
        elif flesch_score >= 40:
            return "College level"
        else:
            return "Graduate level"
    
    def _calculate_content_depth_score(self, word_count: int, vocabulary_diversity: float) -> int:
        """Calculate content depth score using continuous curves.

        Word count: sigmoid peaks around 1200, gentle decay for long content.
        Vocabulary diversity: sigmoid peaks around 0.55, decay for low or high diversity.
        """
        # Word count score: optimal around 1000-1500, smooth decay below 500
        word_score = self._sigmoid(word_count, midpoint=800, steepness=0.005) * 55
        if word_count > 3000:
            word_score = min(word_score, 40)
        elif word_count < 300:
            word_score = min(word_score, 15)

        # Vocabulary diversity score: optimal around 0.5-0.65, too high is repetitive, too low is shallow
        diversity_score = self._sigmoid(vocabulary_diversity, midpoint=0.45, steepness=12) * 45
        if vocabulary_diversity < 0.3:
            diversity_score = min(diversity_score, 15)

        return int(min(max(word_score + diversity_score, 5), 100))
    
    def _calculate_flow_score(self, transition_count: int, word_count: int) -> int:
        """Calculate content flow score using continuous curve.

        Transition density is typically low (most content has 0.5-3 per 100 words
        of the specific transition words we track). The sigmoid midpoint is set at 1.0
        with moderate steepness to produce a reasonable spread.
        """
        if word_count == 0:
            return 15

        transition_density = transition_count / (word_count / 100)

        # Sigmoid centered at 1.0 (decent density), moderate steepness
        score = self._sigmoid(transition_density, midpoint=1.0, steepness=2.5) * 50 + 40
        if transition_density > 5:
            score = max(score - 10, 35)
        return int(min(max(score, 15), 100))
    
    def _calculate_heading_hierarchy_score(self, h1: List[str], h2: List[str], h3: List[str]) -> int:
        """Calculate heading hierarchy score using continuous curves.

        H1: 1 is ideal, score decays for 0 or 2+.
        H2: 4-6 is ideal, score decays for low or high counts.
        H3: presence adds bonus.
        """
        # H1 score: clear peak at 1
        h1_count = len(h1)
        if h1_count == 1:
            h1_score = 40
        elif h1_count == 0:
            h1_score = 15
        else:
            h1_score = max(40 // h1_count, 8)

        # H2 score: sigmoid peaks around 4-6
        h2_count = len(h2)
        h2_score = self._sigmoid(h2_count, midpoint=4, steepness=1.0) * 40
        if h2_count == 0:
            h2_score = 5
        elif h2_count > 10:
            h2_score = max(h2_score * 0.6, 10)

        # H3 bonus: presence is good, diminishing returns
        h3_score = min(len(h3) * 5, 20)

        return int(min(max(h1_score + h2_score + h3_score, 10), 100))
    
    def _calculate_keyword_score(self, keyword_analysis: Dict[str, Any]) -> int:
        """Calculate keyword optimization score using continuous curves.

        Density: sigmoid centered at 2%, smooth peak.
        Heading presence: binary bonus per keyword.
        Early occurrence: sigmoid bonus.
        Missing/over-optimization: smooth penalties.
        """
        density_score = 0
        heading_bonus = 0
        early_bonus = 0

        densities = keyword_analysis.get('keyword_density', {})
        keyword_count = max(len(densities), 1)

        for keyword, density in densities.items():
            # Density score: smooth peak at 1-3%, sigmoid curve
            density_contribution = self._sigmoid(density, midpoint=2.0, steepness=2.0) * 30
            if density > 4:
                density_contribution *= 0.5  # penalty for over-optimization
            density_score += density_contribution

        density_score = density_score / keyword_count

        # Heading presence bonus
        distributions = keyword_analysis.get('keyword_distribution', {})
        for keyword, dist in distributions.items():
            if dist.get('in_headings', False):
                heading_bonus += 15
            first_occ = dist.get('first_occurrence', -1)
            if isinstance(first_occ, (int, float)) and 0 <= first_occ < 150:
                early_bonus += int(self._sigmoid(first_occ, midpoint=75, steepness=-0.04) * 15)

        # Penalize missing keywords and over-optimization
        missing_penalty = len(keyword_analysis.get('missing_keywords', [])) * 8
        over_opt_penalty = len(keyword_analysis.get('over_optimization', [])) * 12

        raw = density_score + heading_bonus + early_bonus - missing_penalty - over_opt_penalty
        return int(min(max(raw, 5), 100))
    
    def _calculate_weighted_score(self, scores: Dict[str, int]) -> int:
        """Calculate weighted overall score.

        AI insight engagement_score is unreliable (no ground truth) so it's excluded
        from the overall score. The remaining 5 categories are re-weighted to sum to 1.0.
        AI insights are still reported in category_scores for display but don't affect
        the overall score.
        """
        weights = {
            'structure': 0.20,
            'keywords': 0.25,
            'readability': 0.20,
            'quality': 0.20,
            'headings': 0.15,
        }

        weighted_sum = sum(scores.get(key, 0) * weight for key, weight in weights.items())
        return int(min(max(weighted_sum, 0), 100))
    
    # Recommendation methods
    def _get_structure_recommendations(self, sections: int, has_intro: bool, has_conclusion: bool, content: str = '') -> List[str]:
        """Get structure recommendations based on actual content analysis"""
        recommendations = []

        if sections < 3:
            recommendations.append("Add more sections to improve content structure and topic coverage")
        elif sections > 8:
            recommendations.append("Consider combining some sections for better flow and readability")

        # More robust intro detection: check first 200 chars for first-person address,
        # question, or general hook — not just keyword matching
        first_200 = (content[:500] if content else '').lower()
        intro_indicators = any([
            has_intro,
            '?' in first_200[:200],
            any(phrase in first_200 for phrase in ['in this', 'this article', 'this guide', 'this post', 'we will', "you'll learn", "let's explore", "whether you're"]),
            first_200.strip().startswith('# '),
        ])
        if not intro_indicators:
            recommendations.append("Add an introduction that hooks the reader and previews key topics")

        # More robust conclusion detection
        last_500 = (content[-500:] if content else '').lower()
        conclusion_indicators = any([
            has_conclusion,
            any(phrase in last_500 for phrase in ['in conclusion', 'to summarize', 'in summary', 'bottom line', 'key takeaways', 'remember that', 'as we\'ve seen']),
        ])
        if not conclusion_indicators:
            recommendations.append("Add a conclusion to summarize key points and provide next steps")

        return recommendations
    
    def _get_readability_recommendations(self, metrics: Dict[str, float], avg_sentence_length: float) -> List[str]:
        """Get readability recommendations with specific, actionable guidance"""
        recommendations = []

        flesch_score = metrics.get('flesch_reading_ease', 0)

        if flesch_score < 30:
            recommendations.append("Content is very difficult to read — shorten sentences, use simpler words, and break up complex ideas")
        elif flesch_score < 50:
            recommendations.append("Content is fairly complex — consider simplifying some sentences and adding more plain-language explanations")

        if avg_sentence_length > 25:
            recommendations.append(f"Average sentence length is {avg_sentence_length:.0f} words — aim for 15-20 words per sentence for better readability")
        elif avg_sentence_length > 20:
            recommendations.append("Some sentences may be too long — try breaking a few into shorter ones for easier reading")

        if flesch_score > 80 and flesch_score < 95:
            recommendations.append("Readability is very good — consider adding slightly more technical depth for expert credibility")

        return recommendations
    
    def _get_content_quality_recommendations(self, word_count: int, vocabulary_diversity: float, transition_count: int) -> List[str]:
        """Get content quality recommendations with specific, actionable guidance"""
        recommendations = []

        if word_count < 400:
            recommendations.append("Content is significantly underdeveloped — expand with detailed explanations, examples, and supporting evidence")
        elif word_count < 800:
            recommendations.append("Content is thin — add depth with specific examples, data points, and detailed explanations for each section")
        elif word_count > 3000:
            recommendations.append("Content is very long — consider whether all sections are necessary or if some could be a separate post")

        if vocabulary_diversity < 0.35:
            recommendations.append("Vocabulary is highly repetitive — use synonyms and varied phrasing to improve engagement")
        elif vocabulary_diversity < 0.45:
            recommendations.append("Vocabulary variety could be improved — try rephrasing repeated terms for more natural flow")

        if transition_count < 2:
            recommendations.append("Very few transition words found — add connectors like 'however', 'therefore', 'furthermore' between ideas")
        elif transition_count < 5:
            recommendations.append("Add more transition words to improve the flow between paragraphs and sections")

        return recommendations
    
    def _get_heading_recommendations(self, h1: List[str], h2: List[str], h3: List[str]) -> List[str]:
        """Get heading recommendations with specific, actionable guidance"""
        recommendations = []

        if len(h1) == 0:
            recommendations.append("Add a main H1 heading — this is the primary title for both readers and search engines")
        elif len(h1) > 1:
            recommendations.append(f"Found {len(h1)} H1 headings — use only one H1 per post for clarity. Convert extras to H2.")

        if len(h2) < 3:
            recommendations.append(f"Only {len(h2)} H2 headings found — add section headings to break up content and improve scanning")
        elif len(h2) > 10:
            recommendations.append(f"{len(h2)} H2 headings may be too many — consider using H3 subheadings within sections for better hierarchy")

        if len(h2) >= 3 and len(h3) == 0 and len(h2) > 5:
            recommendations.append("Consider adding H3 subheadings within longer H2 sections for better content hierarchy")

        return recommendations
    
    async def _run_ai_analysis(self, blog_content: str, keywords_data: Dict[str, Any], non_ai_results: Dict[str, Any], user_id: str = None, outline: Optional[List[Dict[str, Any]]] = None, competitive_advantage: Optional[str] = None) -> Dict[str, Any]:
        """Run single AI analysis for structured insights (provider-agnostic)"""
        if not user_id:
            raise ValueError("user_id is required for subscription checking. Please provide Clerk user ID.")
        try:
            # Prepare context for AI analysis
            context = {
                'blog_content': blog_content,
                'keywords_data': keywords_data,
                'non_ai_results': non_ai_results,
                'outline': outline or [],
                'competitive_advantage': competitive_advantage or '',
            }
            
            # Create AI prompt for structured analysis
            prompt = self._create_ai_analysis_prompt(context)
            
            schema = {
                "type": "object",
                "properties": {
                    "content_quality_insights": {
                        "type": "object",
                        "properties": {
                            "value_proposition": {"type": "string"},
                            "content_gaps": {"type": "array", "items": {"type": "string"}},
                            "improvement_suggestions": {"type": "array", "items": {"type": "string"}},
                            "content_depth_indicators": {
                                "type": "object",
                                "properties": {
                                    "has_specific_data_points": {"type": "boolean"},
                                    "has_examples_or_illustrations": {"type": "boolean"},
                                    "has_actionable_takeaways": {"type": "boolean"},
                                    "depth_assessment": {"type": "string"}
                                }
                            }
                        }
                    },
                    "seo_optimization_insights": {
                        "type": "object",
                        "properties": {
                            "keyword_optimization": {"type": "string"},
                            "content_relevance": {"type": "string"},
                            "search_intent_alignment": {"type": "string"},
                            "seo_improvements": {"type": "array", "items": {"type": "string"}}
                        }
                    },
                    "user_experience_insights": {
                        "type": "object",
                        "properties": {
                            "content_flow": {"type": "string"},
                            "readability_assessment": {"type": "string"},
                            "engagement_factors": {"type": "array", "items": {"type": "string"}},
                            "ux_improvements": {"type": "array", "items": {"type": "string"}}
                        }
                    },
                    "content_strengths": {
                        "type": "object",
                        "properties": {
                            "strongest_sections": {"type": "array", "items": {"type": "string"}},
                            "unique_value_points": {"type": "array", "items": {"type": "string"}},
                            "reader_value_assessment": {"type": "string"}
                        }
                    }
                }
            }
            
            # Provider-agnostic structured response respecting GPT_PROVIDER
            ai_response = llm_text_gen(
                prompt=prompt,
                json_struct=schema,
                system_prompt=None,
                user_id=user_id  # Pass user_id for subscription checking
            )
            
            return ai_response
            
        except Exception as e:
            logger.error(f"AI analysis failed: {e}")
            raise e
    
    def _create_ai_analysis_prompt(self, context: Dict[str, Any]) -> str:
        """Create AI analysis prompt with research context and outline awareness"""
        blog_content = context['blog_content']
        keywords_data = context['keywords_data']
        non_ai_results = context['non_ai_results']
        outline = context.get('outline', [])
        competitive_advantage = context.get('competitive_advantage', '')
        
        # Build outline context
        outline_text = ""
        if outline:
            section_names = []
            for sec in outline[:8]:
                heading = sec.get('heading', '') if isinstance(sec, dict) else getattr(sec, 'heading', '')
                subheadings = sec.get('subheadings', []) if isinstance(sec, dict) else getattr(sec, 'subheadings', [])
                sub_text = f" (subtopics: {', '.join(subheadings[:4])})" if subheadings else ""
                target_words = sec.get('target_words', '') if isinstance(sec, dict) else getattr(sec, 'target_words', '')
                word_text = f" [~{target_words} words]" if target_words else ""
                section_names.append(f"  - {heading}{sub_text}{word_text}")
            outline_text = "\n".join(section_names)
        
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
            research_block += f"\nOUR COMPETITIVE ADVANTAGES: {', '.join(competitive_advantages[:3])}"
        if competitive_advantage:
            research_block += f"\nFOCUSED COMPETITIVE ADVANTAGE: {competitive_advantage}"
        if search_queries:
            research_block += f"\nORIGINAL SEARCH QUERIES: {', '.join(search_queries[:5])}"
        if suggested_angles:
            research_block += f"\nPLANNED CONTENT ANGLES: {', '.join(suggested_angles[:3])}"
        if industry_leaders:
            research_block += f"\nINDUSTRY LEADERS: {', '.join(industry_leaders[:3])}"

        outline_block = ""
        if outline_text:
            outline_block = f"\n\n        PLANNED OUTLINE STRUCTURE:\n{outline_text}"

        advantage_block = ""
        if competitive_advantage:
            advantage_block = f"\n\n        FOCUSED ADVANTAGE: {competitive_advantage}"
        
        prompt = f"""
        Analyze this blog content for SEO optimization and user experience. Provide structured insights based ONLY on what is actually present in the content and keyword data. Do NOT fabricate data, statistics, competitor names, or case studies that are not in the content.

        BLOG CONTENT:
        {blog_content[:3000]}...

        KEYWORDS DATA:
        Primary Keywords: {keywords_data.get('primary', [])}
        Long-tail Keywords: {keywords_data.get('long_tail', [])}
        Semantic Keywords: {keywords_data.get('semantic', [])}
        Search Intent: {keywords_data.get('search_intent', 'informational')}{research_block}

        MEASURED ANALYSIS RESULTS:
        Structure Score: {non_ai_results.get('content_structure', {}).get('structure_score', 0)}/100
        Readability Score: {non_ai_results.get('readability_analysis', {}).get('readability_score', 0)}/100
        Content Quality Score: {non_ai_results.get('content_quality', {}).get('content_depth_score', 0)}/100
        Heading Hierarchy Score: {non_ai_results.get('heading_structure', {}).get('heading_hierarchy_score', 0)}/100
        Word Count: {non_ai_results.get('content_quality', {}).get('word_count', 0)}
        Sections: {non_ai_results.get('content_structure', {}).get('total_sections', 0)}
        Has Introduction: {non_ai_results.get('content_structure', {}).get('has_introduction', False)}
        Has Conclusion: {non_ai_results.get('content_structure', {}).get('has_conclusion', False)}{outline_block}{advantage_block}

        IMPORTANT: SEO metadata (title tag, meta description, Open Graph tags, Twitter cards, JSON-LD schema) will be generated in a separate step. Do NOT recommend adding or improving meta descriptions, title tags, OG tags, or structured data markup — focus only on content-level improvements.

        Provide:
        1. Content Quality Insights: Assess the value proposition based on actual content. Identify specific content gaps (what TOPICS from the planned outline or competitor analysis are missing; do NOT suggest adding case studies unless the content references specific studies). Suggest improvements grounded in what the content currently covers.
        2. Content Depth Indicators: Objectively assess whether the content contains specific data points, examples, or actionable takeaways. These are binary assessments based on what's actually in the text.
        3. SEO Optimization Insights: Evaluate keyword optimization based on the provided keyword data. Assess content relevance and search intent alignment relative to the original search queries.
        4. User Experience Insights: Analyze content flow and readability. Identify engagement factors present in the text.
        5. Content Strengths: Identify the strongest sections of the content by heading name. Note unique value points the content provides. Do NOT invent competitive advantages — only describe what makes THIS content valuable based on the competitive advantages and content gaps listed above.
        """

        return prompt
    
    def _compile_blog_seo_results(self, non_ai_results: Dict[str, Any], ai_insights: Dict[str, Any], keywords_data: Dict[str, Any]) -> Dict[str, Any]:
        """Compile comprehensive SEO analysis results"""
        try:
            # Validate required data - fail fast if missing
            if not non_ai_results:
                raise ValueError("Non-AI analysis results are missing")
            
            if not ai_insights:
                raise ValueError("AI insights are missing")
            
            # Calculate category scores
            # Compute ai_depth_score from measurable content_depth_indicators instead of
            # hallucinated engagement_score. If depth_indicators are present, score based on
            # boolean flags; otherwise default to 50 (neutral).
            ai_quality = ai_insights.get('content_quality_insights', {})
            depth_indicators = ai_quality.get('content_depth_indicators', {})
            if depth_indicators:
                depth_flags = [
                    depth_indicators.get('has_specific_data_points', False),
                    depth_indicators.get('has_examples_or_illustrations', False),
                    depth_indicators.get('has_actionable_takeaways', False),
                ]
                depth_score = 40 + (sum(depth_flags) * 20)  # 40 baseline + 20 per true flag = 40-100
            else:
                depth_score = 50

            category_scores = {
                'structure': non_ai_results.get('content_structure', {}).get('structure_score', 0),
                'keywords': self._calculate_keyword_score(non_ai_results.get('keyword_analysis', {})),
                'readability': non_ai_results.get('readability_analysis', {}).get('readability_score', 0),
                'quality': non_ai_results.get('content_quality', {}).get('content_depth_score', 0),
                'headings': non_ai_results.get('heading_structure', {}).get('heading_hierarchy_score', 0),
                'ai_insights': depth_score
            }
            
            # Calculate overall score
            overall_score = self._calculate_weighted_score(category_scores)
            
            # Compile actionable recommendations
            actionable_recommendations = self._compile_actionable_recommendations(non_ai_results, ai_insights)
            
            # Create visualization data
            visualization_data = self._create_visualization_data(category_scores, non_ai_results)
            
            return {
                'overall_score': overall_score,
                'category_scores': category_scores,
                'detailed_analysis': non_ai_results,
                'ai_insights': ai_insights,
                'keywords_data': keywords_data,
                'visualization_data': visualization_data,
                'actionable_recommendations': actionable_recommendations,
                'generated_at': datetime.utcnow().isoformat(),
                'analysis_summary': self._create_analysis_summary(overall_score, category_scores, ai_insights)
            }
            
        except Exception as e:
            logger.error(f"Results compilation failed: {e}")
            # Fail fast - don't return fallback data
            raise e
    
    def _compile_actionable_recommendations(self, non_ai_results: Dict[str, Any], ai_insights: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Compile actionable recommendations from all sources"""
        recommendations = []

        # Metadata-related keywords to filter out (handled by metadata generator)
        metadata_keywords = ['meta description', 'title tag', 'og tag', 'open graph',
                            'twitter card', 'json-ld', 'schema markup', 'structured data markup']

        def _is_metadata_rec(rec_text: str) -> bool:
            rec_lower = rec_text.lower()
            return any(kw in rec_lower for kw in metadata_keywords)

        # Structure recommendations
        structure_recs = non_ai_results.get('content_structure', {}).get('recommendations', [])
        for rec in structure_recs:
            recommendations.append({
                'category': 'Structure',
                'priority': 'High',
                'recommendation': rec,
                'impact': 'Improves content organization and user experience'
            })

        # Keyword recommendations
        keyword_recs = non_ai_results.get('keyword_analysis', {}).get('recommendations', [])
        for rec in keyword_recs:
            recommendations.append({
                'category': 'Keywords',
                'priority': 'High',
                'recommendation': rec,
                'impact': 'Improves search engine visibility'
            })

        # Readability recommendations
        readability_recs = non_ai_results.get('readability_analysis', {}).get('recommendations', [])
        for rec in readability_recs:
            recommendations.append({
                'category': 'Readability',
                'priority': 'Medium',
                'recommendation': rec,
                'impact': 'Improves user engagement and comprehension'
            })

        # AI insights recommendations (filter out metadata-related recs)
        ai_recs = ai_insights.get('content_quality_insights', {}).get('improvement_suggestions', [])
        for rec in ai_recs:
            if not _is_metadata_rec(rec):
                recommendations.append({
                    'category': 'Content Quality',
                    'priority': 'Medium',
                    'recommendation': rec,
                    'impact': 'Enhances content value and engagement'
                })

        # SEO improvement recommendations (filter metadata recs)
        seo_recs = ai_insights.get('seo_optimization_insights', {}).get('seo_improvements', [])
        for rec in seo_recs:
            if not _is_metadata_rec(rec):
                recommendations.append({
                    'category': 'SEO',
                    'priority': 'Medium',
                    'recommendation': rec,
                    'impact': 'Improves search engine optimization'
                })

        # Content strengths as informational (lower priority)
        content_strengths = ai_insights.get('content_strengths', {})
        strong_sections = content_strengths.get('strongest_sections', [])
        if strong_sections:
            recommendations.append({
                'category': 'Strengths',
                'priority': 'Low',
                'recommendation': f"Strongest sections: {', '.join(strong_sections[:3])}. Consider expanding these areas further.",
                'impact': 'Leverages existing content strengths'
            })

        return recommendations
    
    def _create_visualization_data(self, category_scores: Dict[str, int], non_ai_results: Dict[str, Any]) -> Dict[str, Any]:
        """Create data for visualization components"""
        return {
            'score_radar': {
                'categories': list(category_scores.keys()),
                'scores': list(category_scores.values()),
                'max_score': 100
            },
            'keyword_analysis': {
                'densities': non_ai_results.get('keyword_analysis', {}).get('keyword_density', {}),
                'missing_keywords': non_ai_results.get('keyword_analysis', {}).get('missing_keywords', []),
                'over_optimization': non_ai_results.get('keyword_analysis', {}).get('over_optimization', [])
            },
            'readability_metrics': non_ai_results.get('readability_analysis', {}).get('metrics', {}),
            'content_stats': {
                'word_count': non_ai_results.get('content_quality', {}).get('word_count', 0),
                'sections': non_ai_results.get('content_structure', {}).get('total_sections', 0),
                'paragraphs': non_ai_results.get('content_structure', {}).get('total_paragraphs', 0)
            }
        }
    
    def _create_analysis_summary(self, overall_score: int, category_scores: Dict[str, int], ai_insights: Dict[str, Any]) -> Dict[str, Any]:
        """Create analysis summary"""
        # Determine overall grade
        if overall_score >= 90:
            grade = 'A'
            status = 'Excellent'
        elif overall_score >= 80:
            grade = 'B'
            status = 'Good'
        elif overall_score >= 70:
            grade = 'C'
            status = 'Fair'
        elif overall_score >= 60:
            grade = 'D'
            status = 'Needs Improvement'
        else:
            grade = 'F'
            status = 'Poor'
        
        # Find strongest and weakest categories
        strongest_category = max(category_scores.items(), key=lambda x: x[1])
        weakest_category = min(category_scores.items(), key=lambda x: x[1])
        
        return {
            'overall_grade': grade,
            'status': status,
            'strongest_category': strongest_category[0],
            'weakest_category': weakest_category[0],
            'key_strengths': self._identify_key_strengths(category_scores),
            'key_weaknesses': self._identify_key_weaknesses(category_scores),
            'ai_summary': ai_insights.get('content_quality_insights', {}).get('value_proposition', 'Content analysis completed.')
        }
    
    def _identify_key_strengths(self, category_scores: Dict[str, int]) -> List[str]:
        """Identify key strengths"""
        strengths = []
        
        for category, score in category_scores.items():
            if score >= 80:
                strengths.append(f"Strong {category} optimization")
        
        return strengths
    
    def _identify_key_weaknesses(self, category_scores: Dict[str, int]) -> List[str]:
        """Identify key weaknesses"""
        weaknesses = []
        
        for category, score in category_scores.items():
            if score < 60:
                weaknesses.append(f"Needs improvement in {category}")
        
        return weaknesses
    
    def _create_error_result(self, error_message: str) -> Dict[str, Any]:
        """Create error result - this should not be used in fail-fast mode"""
        raise ValueError(f"Error result creation not allowed in fail-fast mode: {error_message}")
