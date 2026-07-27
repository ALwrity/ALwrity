"""
Blog Writer Service - Main orchestrator for AI Blog Writer.

Coordinates research, outline generation, content creation, and optimization.
"""

from typing import Dict, Any, List, Optional
from loguru import logger

from models.blog_models import (
    BlogResearchRequest,
    BlogResearchResponse,
    BlogOutlineRequest,
    BlogOutlineResponse,
    BlogOutlineRefineRequest,
    BlogSectionRequest,
    BlogSectionResponse,
    BlogOptimizeRequest,
    BlogOptimizeResponse,
    BlogSEOAnalyzeRequest,
    BlogSEOAnalyzeResponse,
    BlogSEOMetadataRequest,
    BlogSEOMetadataResponse,
    BlogPublishRequest,
    BlogPublishResponse,
    BlogOutlineSection,
    ResearchSource,
)

from ..research import ResearchService
from ..outline import OutlineService
from ..content.enhanced_content_generator import EnhancedContentGenerator
from ..content.medium_blog_generator import MediumBlogGenerator
from ..content.blog_rewriter import BlogRewriter
from services.llm_providers.gemini_provider import gemini_structured_json_response
from services.cache.persistent_content_cache import persistent_content_cache
from models.blog_models import (
    MediumBlogGenerateRequest,
    MediumBlogGenerateResult,
    MediumGeneratedSection,
)

# Import task manager - we'll create a simple one for this service
class SimpleTaskManager:
    """Simple task manager for BlogWriterService."""
    
    def __init__(self):
        self.tasks = {}
    
    def start_task(self, task_id: str, func, **kwargs):
        """Start a task with the given function and arguments."""
        import asyncio
        self.tasks[task_id] = {
            "status": "running",
            "progress": "Starting...",
            "result": None,
            "error": None
        }
        # Start the task in the background
        asyncio.create_task(self._run_task(task_id, func, **kwargs))
    
    async def _run_task(self, task_id: str, func, **kwargs):
        """Run the task function."""
        try:
            await func(task_id, **kwargs)
        except Exception as e:
            self.tasks[task_id]["status"] = "failed"
            self.tasks[task_id]["error"] = str(e)
            logger.error(f"Task {task_id} failed: {e}")
    
    def update_task_status(self, task_id: str, status: str, progress: str = None, result=None):
        """Update task status."""
        if task_id in self.tasks:
            self.tasks[task_id]["status"] = status
            if progress:
                self.tasks[task_id]["progress"] = progress
            if result:
                self.tasks[task_id]["result"] = result
    
    def get_task_status(self, task_id: str):
        """Get task status."""
        return self.tasks.get(task_id, {"status": "not_found"})


class BlogWriterService:
    """Main service orchestrator for AI Blog Writer functionality."""
    
    def __init__(self):
        self.research_service = ResearchService()
        self.outline_service = OutlineService()
        self.content_generator = EnhancedContentGenerator()
        self.task_manager = SimpleTaskManager()
        self.medium_blog_generator = MediumBlogGenerator()
        self.blog_rewriter = BlogRewriter(self.task_manager)
    
    # Research Methods
    async def research(self, request: BlogResearchRequest, user_id: str) -> BlogResearchResponse:
        """Conduct comprehensive research using Google Search grounding."""
        return await self.research_service.research(request, user_id)
    
    async def research_with_progress(self, request: BlogResearchRequest, task_id: str, user_id: str) -> BlogResearchResponse:
        """Conduct research with real-time progress updates."""
        return await self.research_service.research_with_progress(request, task_id, user_id)
    
    # Outline Methods
    async def generate_outline(self, request: BlogOutlineRequest, user_id: str) -> BlogOutlineResponse:
        """Generate AI-powered outline from research data.
        
        Args:
            request: Outline generation request with research data
            user_id: User ID (required for subscription checks and usage tracking)
        """
        if not user_id:
            raise ValueError("user_id is required for outline generation (subscription checks and usage tracking)")
        return await self.outline_service.generate_outline(request, user_id)
    
    async def generate_outline_with_progress(self, request: BlogOutlineRequest, task_id: str, user_id: str) -> BlogOutlineResponse:
        """Generate outline with real-time progress updates."""
        return await self.outline_service.generate_outline_with_progress(request, task_id, user_id)
    
    async def refine_outline(self, request: BlogOutlineRefineRequest) -> BlogOutlineResponse:
        """Refine outline with HITL operations."""
        return await self.outline_service.refine_outline(request)
    
    async def enhance_section_with_ai(self, section: BlogOutlineSection, focus: str = "general improvement") -> BlogOutlineSection:
        """Enhance a section using AI."""
        return await self.outline_service.enhance_section_with_ai(section, focus)
    
    async def optimize_outline_with_ai(self, outline: List[BlogOutlineSection], focus: str = "general optimization", research_context: str = "") -> List[BlogOutlineSection]:
        """Optimize entire outline for better flow and SEO."""
        return await self.outline_service.optimize_outline_with_ai(outline, focus, research_context=research_context)
    
    def rebalance_word_counts(self, outline: List[BlogOutlineSection], target_words: int) -> List[BlogOutlineSection]:
        """Rebalance word count distribution across sections."""
        return self.outline_service.rebalance_word_counts(outline, target_words)
    
    # Content Generation Methods
    async def generate_section(self, request: BlogSectionRequest, user_id: Optional[str] = None) -> BlogSectionResponse:
        """Generate section content from outline."""
        research_ctx = request.research
        competitive_advantage = request.competitive_advantage
        try:
            ai_result = await self.content_generator.generate_section(
                section=request.section,
                research=research_ctx,
                mode=(request.mode or "polished"),
                user_id=user_id,
                competitive_advantage=competitive_advantage,
            )
            markdown = ai_result.get('content') or ai_result.get('markdown') or ''
            citations = []
            # Map basic citations from sources if present
            for s in ai_result.get('sources', [])[:5]:
                citations.append({
                    "title": s.get('title') if isinstance(s, dict) else getattr(s, 'title', ''),
                    "url": s.get('url') if isinstance(s, dict) else getattr(s, 'url', ''),
                })
            if not markdown:
                markdown = f"## {request.section.heading}\n\n(Generated content was empty.)"
            return BlogSectionResponse(
                success=True,
                markdown=markdown,
                citations=citations,
                continuity_metrics=ai_result.get('continuity_metrics')
            )
        except Exception as e:
            logger.error(f"Section generation failed: {e}")
            fallback = f"## {request.section.heading}\n\nThis section will cover: {', '.join(request.section.key_points)}."
            return BlogSectionResponse(success=False, markdown=fallback, citations=[])
    
    async def optimize_section(self, request: BlogOptimizeRequest) -> BlogOptimizeResponse:
        """Optimize section content for readability and SEO."""
        return BlogOptimizeResponse(
            success=False,
            optimized=request.content,
            diff_preview=None,
            error="Section optimization is not yet available. Content returned unchanged."
        )
    
    # SEO and Analysis Methods (TODO: Extract to optimization module)
    async def hallucination_check(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Run hallucination detection on provided text."""
        text = str(payload.get("text", "") or "").strip()
        if not text:
            return {"success": False, "error": "No text provided"}

        # Prefer direct service use over HTTP proxy
        try:
            from services.hallucination_detector import HallucinationDetector
            detector = HallucinationDetector()
            result = await detector.detect_hallucinations(text)

            # Serialize dataclass-like result to dict
            claims = []
            for c in result.claims:
                claims.append({
                    "text": c.text,
                    "confidence": c.confidence,
                    "assessment": c.assessment,
                    "supporting_sources": c.supporting_sources,
                    "refuting_sources": c.refuting_sources,
                    "reasoning": c.reasoning,
                })

            return {
                "success": True,
                "overall_confidence": result.overall_confidence,
                "total_claims": result.total_claims,
                "supported_claims": result.supported_claims,
                "refuted_claims": result.refuted_claims,
                "insufficient_claims": result.insufficient_claims,
                "timestamp": result.timestamp,
                "claims": claims,
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def seo_analyze(self, request: BlogSEOAnalyzeRequest, user_id: Optional[str] = None) -> BlogSEOAnalyzeResponse:
        """Analyze content for SEO optimization using comprehensive blog-specific analyzer."""
        try:
            from services.blog_writer.seo.blog_content_seo_analyzer import BlogContentSEOAnalyzer

            if not user_id:
                raise ValueError("user_id is required for subscription checking. Please provide Clerk user ID.")

            content = request.content or ""
            target_keywords = request.keywords or []

            # Use research data from request if available, otherwise create fallback
            if request.research_data:
                research_data = request.research_data
                logger.info(f"Using research data from request: {research_data.get('keyword_analysis', {})}")
            else:
                # Fallback for backward compatibility
                research_data = {
                    "keyword_analysis": {
                        "primary": target_keywords,
                        "long_tail": [],
                        "semantic": [],
                        "all_keywords": target_keywords,
                        "search_intent": "informational"
                    }
                }
                logger.warning("No research data provided, using fallback keywords")
            
            # Use our comprehensive SEO analyzer
            analyzer = BlogContentSEOAnalyzer()
            analysis_results = await analyzer.analyze_blog_content(content, research_data, user_id=user_id)
            
            # Convert results to response format
            recommendations = analysis_results.get('actionable_recommendations', [])
            # Convert recommendation objects to strings
            recommendation_strings = []
            for rec in recommendations:
                if isinstance(rec, dict):
                    recommendation_strings.append(f"[{rec.get('category', 'General')}] {rec.get('recommendation', '')}")
                else:
                    recommendation_strings.append(str(rec))
            
            return BlogSEOAnalyzeResponse(
                success=True,
                seo_score=float(analysis_results.get('overall_score', 0)),
                density=analysis_results.get('visualization_data', {}).get('keyword_analysis', {}).get('densities', {}),
                structure=analysis_results.get('detailed_analysis', {}).get('content_structure', {}),
                readability=analysis_results.get('detailed_analysis', {}).get('readability_analysis', {}),
                link_suggestions=[],
                image_alt_status={"total_images": 0, "missing_alt": 0},
                recommendations=recommendation_strings
            )
            
        except Exception as e:
            logger.error(f"SEO analysis failed: {e}")
            return BlogSEOAnalyzeResponse(
                success=False,
                seo_score=0.0,
                density={},
                structure={},
                readability={},
                link_suggestions=[],
                image_alt_status={"total_images": 0, "missing_alt": 0},
                recommendations=[f"SEO analysis failed: {str(e)}"]
            )

    async def seo_metadata(self, request: BlogSEOMetadataRequest, user_id: Optional[str] = None) -> BlogSEOMetadataResponse:
        """Generate comprehensive SEO metadata for content."""
        try:
            from services.blog_writer.seo.blog_seo_metadata_generator import BlogSEOMetadataGenerator
            
            if not user_id:
                raise ValueError("user_id is required for subscription checking. Please provide Clerk user ID.")
            
            # Initialize metadata generator
            metadata_generator = BlogSEOMetadataGenerator()
            
            # Extract outline and seo_analysis from request
            outline = request.outline if hasattr(request, 'outline') else None
            seo_analysis = request.seo_analysis if hasattr(request, 'seo_analysis') else None
            
            # Generate comprehensive metadata with full context
            metadata_results = await metadata_generator.generate_comprehensive_metadata(
                blog_content=request.content,
                blog_title=request.title or "Untitled Blog Post",
                research_data=request.research_data or {},
                outline=outline,
                seo_analysis=seo_analysis,
                user_id=user_id
            )
            
            # Convert to BlogSEOMetadataResponse format
            return BlogSEOMetadataResponse(
                success=metadata_results.get('success', True),
                title_options=metadata_results.get('title_options', []),
                meta_descriptions=metadata_results.get('meta_descriptions', []),
                seo_title=metadata_results.get('seo_title'),
                meta_description=metadata_results.get('meta_description'),
                url_slug=metadata_results.get('url_slug', ''),
                blog_tags=metadata_results.get('blog_tags', []),
                blog_categories=metadata_results.get('blog_categories', []),
                social_hashtags=metadata_results.get('social_hashtags', []),
                open_graph=metadata_results.get('open_graph', {}),
                twitter_card=metadata_results.get('twitter_card', {}),
                json_ld_schema=metadata_results.get('json_ld_schema', {}),
                canonical_url=metadata_results.get('canonical_url', ''),
                reading_time=metadata_results.get('reading_time', 0.0),
                focus_keyword=metadata_results.get('focus_keyword', ''),
                generated_at=metadata_results.get('generated_at', ''),
                optimization_score=metadata_results.get('metadata_summary', {}).get('optimization_score', 0)
            )
            
        except Exception as e:
            logger.error(f"SEO metadata generation failed: {e}")
            # Return fallback response
            return BlogSEOMetadataResponse(
                success=False,
                title_options=[request.title or "Generated SEO Title"],
                meta_descriptions=["Compelling meta description..."],
                open_graph={"title": request.title or "OG Title", "image": ""},
                twitter_card={"card": "summary_large_image"},
                json_ld_schema={"@type": "Article"},
                error=str(e)
            )

    async def publish(self, request: BlogPublishRequest) -> BlogPublishResponse:
        """Publish content to specified platform.
        
        NOTE: This endpoint is a STUB / placeholder. The actual publish flow
        bypasses this method entirely — the frontend calls platform-specific
        endpoints directly:
          - Wix:  POST /api/wix/publish  (wix_routes.py)
          - WordPress: POST /api/wordpress/publish  (routers/wordpress.py)
        
        TODO: Either remove this stub or wire it as a unified dispatcher that
        routes to the correct platform service. Keep alive until the new
        unified publish flow (pre-publish checklist + schedule + history) is
        built and this becomes the single entry point for all publishing.
        """
        return BlogPublishResponse(
            success=False,
            platform=request.platform,
            url=None,
            error="Publishing is not yet available through this endpoint. Please use platform-specific endpoints: /api/wix/publish or /api/wordpress/publish."
        )

    async def generate_medium_blog_with_progress(self, req: MediumBlogGenerateRequest, task_id: str, user_id: str, db: Session = None) -> MediumBlogGenerateResult:
        """Use Gemini structured JSON to generate a medium-length blog in one call.
        
        Args:
            req: Medium blog generation request
            task_id: Task ID for progress updates
            user_id: User ID (required for subscription checks and usage tracking)
            db: Database session (optional, for saving assets)
        """
        if not user_id:
            raise ValueError("user_id is required for medium blog generation (subscription checks and usage tracking)")
        return await self.medium_blog_generator.generate_medium_blog_with_progress(req, task_id, user_id, db)

    async def analyze_flow_basic(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze flow metrics for entire blog using single AI call (cost-effective)."""
        try:
            import asyncio
            # Extract blog content from request
            sections = request.get("sections", [])
            title = request.get("title", "Untitled Blog")
            user_id = request.get("user_id")
            
            if not sections:
                return {"error": "No sections provided for analysis"}
            
            # Combine all content for analysis
            full_content = f"Title: {title}\n\n"
            for section in sections:
                full_content += f"Section: {section.get('heading', 'Untitled')}\n"
                full_content += f"Content: {section.get('content', '')}\n\n"
            
            # Build analysis prompt
            system_prompt = """You are an expert content analyst specializing in narrative flow, consistency, and progression analysis. 
            Analyze the provided blog content and provide detailed, actionable feedback for improvement. 
            Focus on how well the content flows from section to section, maintains consistency in tone and style, 
            and progresses logically through the topic."""
            
            analysis_prompt = f"""
            Analyze the following blog content for narrative flow, consistency, and progression:
            
            {full_content}
            
            Evaluate each section and provide overall analysis with specific scores and actionable suggestions.
            Consider:
            - How well each section flows into the next
            - Consistency in tone, style, and voice throughout
            - Logical progression of ideas and arguments
            - Transition quality between sections
            - Overall coherence and readability
            
            IMPORTANT: For each section in the response, use the exact section ID provided in the input.
            The section IDs in your response must match the section IDs from the input exactly.
            
            Provide detailed analysis with specific, actionable suggestions for improvement.
            """
            
            from services.llm_providers.main_text_generation import llm_text_gen
            
            schema = {
                "type": "object",
                "properties": {
                    "overall_flow_score": {"type": "number", "minimum": 0.0, "maximum": 1.0},
                    "overall_consistency_score": {"type": "number", "minimum": 0.0, "maximum": 1.0},
                    "overall_progression_score": {"type": "number", "minimum": 0.0, "maximum": 1.0},
                    "overall_coherence_score": {"type": "number", "minimum": 0.0, "maximum": 1.0},
                    "sections": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "section_id": {"type": "string"},
                                "heading": {"type": "string"},
                                "flow_score": {"type": "number", "minimum": 0.0, "maximum": 1.0},
                                "consistency_score": {"type": "number", "minimum": 0.0, "maximum": 1.0},
                                "progression_score": {"type": "number", "minimum": 0.0, "maximum": 1.0},
                                "coherence_score": {"type": "number", "minimum": 0.0, "maximum": 1.0},
                                "transition_quality": {"type": "number", "minimum": 0.0, "maximum": 1.0},
                                "suggestions": {"type": "array", "items": {"type": "string"}},
                                "strengths": {"type": "array", "items": {"type": "string"}},
                                "improvement_areas": {"type": "array", "items": {"type": "string"}}
                            },
                            "required": ["section_id", "heading", "flow_score", "consistency_score", "progression_score", "coherence_score", "transition_quality", "suggestions"]
                        }
                    },
                    "overall_suggestions": {"type": "array", "items": {"type": "string"}},
                    "overall_strengths": {"type": "array", "items": {"type": "string"}},
                    "overall_improvement_areas": {"type": "array", "items": {"type": "string"}},
                    "transition_analysis": {
                        "type": "object",
                        "properties": {
                            "overall_transition_quality": {"type": "number", "minimum": 0.0, "maximum": 1.0},
                            "transition_suggestions": {"type": "array", "items": {"type": "string"}}
                        }
                    }
                },
                "required": ["overall_flow_score", "overall_consistency_score", "overall_progression_score", "overall_coherence_score", "sections", "overall_suggestions"]
            }
            
            result = await asyncio.to_thread(
                llm_text_gen,
                analysis_prompt,
                system_prompt,
                schema,
                user_id,
                None,   # preferred_hf_models
                None,   # preferred_provider
                None,   # flow_type
                4096,   # max_tokens
                0.3     # temperature
            )
            
            if result and not result.get("error"):
                logger.info("Basic flow analysis completed successfully")
                return {"success": True, "analysis": result, "mode": "basic"}
            else:
                error_msg = result.get("error", "Analysis failed") if result else "No response from AI"
                logger.error(f"Basic flow analysis failed: {error_msg}")
                return {"error": error_msg}
                
        except Exception as e:
            logger.error(f"Basic flow analysis error: {e}")
            return {"error": str(e)}

    async def analyze_flow_advanced(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze flow metrics for each section individually (detailed but expensive)."""
        try:
            # Use the existing enhanced content generator for detailed analysis
            sections = request.get("sections", [])
            title = request.get("title", "Untitled Blog")
            user_id = request.get("user_id")
            
            if not sections:
                return {"error": "No sections provided for analysis"}
            
            results = []
            for section in sections:
                # Use the existing flow analyzer for each section
                section_content = section.get("content", "")
                section_heading = section.get("heading", "Untitled")
                
                # Get previous section context for better analysis
                prev_section_content = ""
                if len(results) > 0:
                    prev_section_content = results[-1].get("content", "")
                
                # Use the existing flow analyzer
                flow_metrics = self.content_generator.flow.assess_flow(
                    prev_section_content, 
                    section_content, 
                    use_llm=True,
                    user_id=user_id
                )
                
                results.append({
                    "section_id": section.get("id", "unknown"),
                    "heading": section_heading,
                    "flow_score": flow_metrics.get("flow", 0.0),
                    "consistency_score": flow_metrics.get("consistency", 0.0),
                    "progression_score": flow_metrics.get("progression", 0.0),
                    "detailed_analysis": flow_metrics.get("analysis", ""),
                    "suggestions": flow_metrics.get("suggestions", [])
                })
            
            # Calculate overall scores
            overall_flow = sum(r["flow_score"] for r in results) / len(results) if results else 0.0
            overall_consistency = sum(r["consistency_score"] for r in results) / len(results) if results else 0.0
            overall_progression = sum(r["progression_score"] for r in results) / len(results) if results else 0.0
            
            logger.info("Advanced flow analysis completed successfully")
            return {
                "success": True,
                "analysis": {
                    "overall_flow_score": overall_flow,
                    "overall_consistency_score": overall_consistency,
                    "overall_progression_score": overall_progression,
                    "sections": results
                },
                "mode": "advanced"
            }
            
        except Exception as e:
            logger.error(f"Advanced flow analysis error: {e}")
            return {"error": str(e)}

    def start_blog_rewrite(self, request: Dict[str, Any]) -> str:
        """Start blog rewrite task with user feedback."""
        return self.blog_rewriter.start_blog_rewrite(request)
