"""
Prompt Chain Orchestrator for 12-Step Calendar Generation

This orchestrator manages the complete 12-step prompt chaining process for generating
high-quality content calendars with progressive refinement and quality validation.
"""

import asyncio
import time
from datetime import datetime
from typing import Dict, Any, List, Optional, Callable
from loguru import logger

from .step_manager import StepManager
from .context_manager import ContextManager
from .progress_tracker import ProgressTracker
from .error_handler import ErrorHandler
from .steps.base_step import PromptStep, PlaceholderStep
from .steps.phase1.phase1_steps import ContentStrategyAnalysisStep, GapAnalysisStep, AudiencePlatformStrategyStep
from .steps.phase2.phase2_steps import CalendarFrameworkStep, ContentPillarDistributionStep, PlatformSpecificStrategyStep
from .steps.phase3.phase3_steps import WeeklyThemeDevelopmentStep, DailyContentPlanningStep, ContentRecommendationsStep
from .steps.phase4.step10_implementation import PerformanceOptimizationStep
from .steps.phase4.step11_implementation import StrategyAlignmentValidationStep
from .steps.phase4.step12_implementation import FinalCalendarAssemblyStep

# Import data processing modules
import sys
import os

# Add the services directory to the path for proper imports
services_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
if services_dir not in sys.path:
    sys.path.insert(0, services_dir)

from calendar_generation_datasource_framework.data_processing import ComprehensiveUserDataProcessor


class PromptChainOrchestrator:
    """
    Main orchestrator for 12-step prompt chaining calendar generation.
    
    This orchestrator manages:
    - 4 phases of calendar generation
    - 12 progressive refinement steps
    - Quality gate validation at each step
    - Context management across steps
    - Error handling and recovery
    - Progress tracking and monitoring
    """
    
    def __init__(self, db_session=None):
        """Initialize the prompt chain orchestrator."""
        self.step_manager = StepManager()
        self.context_manager = ContextManager()
        self.progress_tracker = ProgressTracker()
        self.error_handler = ErrorHandler()
        
        # Store database session for injection
        self.db_session = db_session
        
        # Data processing modules for 12-step preparation
        self.comprehensive_user_processor = ComprehensiveUserDataProcessor()
        
        # Inject database service if available
        if db_session:
            try:
                from services.content_planning_db import ContentPlanningDBService
                db_service = ContentPlanningDBService(db_session)
                self.comprehensive_user_processor.content_planning_db_service = db_service
                logger.info("✅ Database service injected into comprehensive user processor")
            except Exception as e:
                logger.error(f"❌ Failed to inject database service: {e}")
                self.comprehensive_user_processor.content_planning_db_service = None
        
        # 12-step configuration
        self.steps = self._initialize_steps()
        self.phases = self._initialize_phases()
        
        logger.info("🚀 Prompt Chain Orchestrator initialized - 12-step framework ready")
    
    def _initialize_steps(self) -> Dict[str, PromptStep]:
        """Initialize all 12 steps of the prompt chain."""
        steps = {}
        
        # Create database service if available
        db_service = None
        if self.db_session:
            try:
                from services.content_planning_db import ContentPlanningDBService
                db_service = ContentPlanningDBService(self.db_session)
                logger.info("✅ Database service created for step injection")
            except Exception as e:
                logger.error(f"❌ Failed to create database service for steps: {e}")
        
        # Phase 1: Foundation (Steps 1-3) - REAL IMPLEMENTATIONS
        steps["step_01"] = ContentStrategyAnalysisStep()
        steps["step_02"] = GapAnalysisStep()
        steps["step_03"] = AudiencePlatformStrategyStep()
        
        # Inject database service into Phase 1 steps
        if db_service:
            # Step 1: Content Strategy Analysis
            if hasattr(steps["step_01"], 'strategy_processor'):
                steps["step_01"].strategy_processor.content_planning_db_service = db_service
                logger.info("✅ Database service injected into Step 1 strategy processor")
            
            # Step 2: Gap Analysis
            if hasattr(steps["step_02"], 'gap_processor'):
                steps["step_02"].gap_processor.content_planning_db_service = db_service
                logger.info("✅ Database service injected into Step 2 gap processor")
            
            # Step 3: Audience Platform Strategy
            if hasattr(steps["step_03"], 'comprehensive_processor'):
                steps["step_03"].comprehensive_processor.content_planning_db_service = db_service
                logger.info("✅ Database service injected into Step 3 comprehensive processor")
        
        # Phase 2: Structure (Steps 4-6) - REAL IMPLEMENTATIONS
        steps["step_04"] = CalendarFrameworkStep()
        steps["step_05"] = ContentPillarDistributionStep()
        steps["step_06"] = PlatformSpecificStrategyStep()
        
        # Inject database service into Phase 2 steps
        if db_service:
            # Step 4: Calendar Framework
            if hasattr(steps["step_04"], 'comprehensive_user_processor'):
                steps["step_04"].comprehensive_user_processor.content_planning_db_service = db_service
                logger.info("✅ Database service injected into Step 4 comprehensive processor")
            
            # Step 5: Content Pillar Distribution
            if hasattr(steps["step_05"], 'comprehensive_user_processor'):
                steps["step_05"].comprehensive_user_processor.content_planning_db_service = db_service
                logger.info("✅ Database service injected into Step 5 comprehensive processor")
            
            # Step 6: Platform Specific Strategy
            if hasattr(steps["step_06"], 'comprehensive_user_processor'):
                steps["step_06"].comprehensive_user_processor.content_planning_db_service = db_service
                logger.info("✅ Database service injected into Step 6 comprehensive processor")
        
        # Phase 3: Content (Steps 7-9) - REAL IMPLEMENTATIONS
        steps["step_07"] = WeeklyThemeDevelopmentStep()
        steps["step_08"] = DailyContentPlanningStep()
        steps["step_09"] = ContentRecommendationsStep()
        
        # Inject database service into Phase 3 steps
        if db_service:
            # Step 7: Weekly Theme Development
            if hasattr(steps["step_07"], 'comprehensive_user_processor'):
                steps["step_07"].comprehensive_user_processor.content_planning_db_service = db_service
                logger.info("✅ Database service injected into Step 7 comprehensive processor")
            if hasattr(steps["step_07"], 'strategy_processor'):
                steps["step_07"].strategy_processor.content_planning_db_service = db_service
                logger.info("✅ Database service injected into Step 7 strategy processor")
            if hasattr(steps["step_07"], 'gap_analysis_processor'):
                steps["step_07"].gap_analysis_processor.content_planning_db_service = db_service
                logger.info("✅ Database service injected into Step 7 gap analysis processor")
        
        # Phase 4: Optimization (Steps 10-12) - REAL IMPLEMENTATIONS
        steps["step_10"] = PerformanceOptimizationStep()
        steps["step_11"] = StrategyAlignmentValidationStep()
        steps["step_12"] = FinalCalendarAssemblyStep()
        
        return steps
    
    def _initialize_phases(self) -> Dict[str, List[str]]:
        """Initialize the 4 phases of calendar generation."""
        return {
            "phase_1_foundation": ["step_01", "step_02", "step_03"],
            "phase_2_structure": ["step_04", "step_05", "step_06"],
            "phase_3_content": ["step_07", "step_08", "step_09"],
            "phase_4_optimization": ["step_10", "step_11", "step_12"]
        }
    
    def _get_phase_for_step(self, step_number: int) -> str:
        """Get the phase name for a given step number."""
        if step_number <= 3:
            return "phase_1_foundation"
        elif step_number <= 6:
            return "phase_2_structure"
        elif step_number <= 9:
            return "phase_3_content"
        else:
            return "phase_4_optimization"
    
    async def generate_calendar(
        self,
        user_id: int,
        strategy_id: Optional[int] = None,
        calendar_type: str = "monthly",
        industry: Optional[str] = None,
        business_size: str = "sme",
        strategy_digest: Optional[Dict[str, Any]] = None,
        progress_callback: Optional[Callable] = None
    ) -> Dict[str, Any]:
        """
        Generate comprehensive calendar using 12-step prompt chaining.
        
        Args:
            user_id: User ID
            strategy_id: Optional strategy ID
            calendar_type: Type of calendar (monthly, weekly, custom)
            industry: Business industry
            business_size: Business size (startup, sme, enterprise)
            strategy_digest: QA-6 handoff: compact digest of the confirmed strategy
                (pillars, preferred formats, frequency, brand voice, best timing) so
                content scheduling inherits the strategy.
            progress_callback: Optional callback for progress updates
            
        Returns:
            Dict containing comprehensive calendar data
        """
        try:
            start_time = time.time()
            logger.info(f"🚀 Starting 12-step calendar generation for user {user_id}")
            
            # Initialize context with user data
            context = await self._initialize_context(
                user_id, strategy_id, calendar_type, industry, business_size, strategy_digest
            )
            
            # Initialize progress tracking
            self.progress_tracker.initialize(12, progress_callback)
            
            # Execute 12-step process
            result = await self._execute_12_step_process(context)
            
            # Calculate processing time
            processing_time = time.time() - start_time
            
            # Add metadata
            result.update({
                "user_id": user_id,
                "strategy_id": strategy_id,
                "processing_time": processing_time,
                "generated_at": datetime.now().isoformat(),
                "framework_version": "12-step-v1.0",
                "status": "completed"
            })
            
            logger.info(f"✅ 12-step calendar generation completed for user {user_id}")
            return result
            
        except Exception as e:
            logger.error(f"❌ Error in 12-step calendar generation: {str(e)}")
            return await self.error_handler.handle_error(e, user_id, strategy_id)
    
    async def _initialize_context(
        self,
        user_id: int,
        strategy_id: Optional[int],
        calendar_type: str,
        industry: Optional[str],
        business_size: str,
        strategy_digest: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Initialize context with user data and configuration."""
        try:
            logger.info(f"🔍 Initializing context for user {user_id}")
            
            # Get comprehensive user data
            user_data = await self._get_comprehensive_user_data(user_id, strategy_id)
            
            # QA-6 calendar handoff: merge the confirmed strategy digest into
            # user_data so any step that serializes user_data to a prompt inherits
            # the strategy's pillars / formats / frequency / brand voice / timing.
            digest = strategy_digest or {}
            if digest:
                user_data["strategy_digest"] = digest
            
            # Initialize context
            context = {
                "user_id": user_id,
                "strategy_id": strategy_id,
                "calendar_type": calendar_type,
                "industry": industry or user_data.get("industry", "technology"),
                "business_size": business_size,
                "user_data": user_data,
                "strategy_digest": digest,
                "step_results": {},
                "quality_scores": {},
                "current_step": 0,
                "phase": "initialization"
            }
            
            # Initialize context manager
            await self.context_manager.initialize(context)
            
            logger.info(f"✅ Context initialized for user {user_id}")
            return context
            
        except Exception as e:
            logger.error(f"❌ Error initializing context: {str(e)}")
            raise
    
    async def _get_comprehensive_user_data(self, user_id: int, strategy_id: Optional[int]) -> Dict[str, Any]:
        """Get comprehensive user data for calendar generation with caching support."""
        try:
            # Try to use cached version if available
            try:
                user_data = await self.comprehensive_user_processor.get_comprehensive_user_data_cached(
                    user_id, strategy_id, db_session=getattr(self, 'db_session', None)
                )
                return user_data
            except AttributeError:
                # Fallback to direct method if cached version not available
                user_data = await self.comprehensive_user_processor.get_comprehensive_user_data(user_id, strategy_id)
                return user_data
        except Exception as e:
            logger.error(f"❌ Error getting comprehensive user data: {str(e)}")
            # Fallback to placeholder data
            return {
                "user_id": user_id,
                "strategy_id": strategy_id,
                "industry": "technology",
                "onboarding_data": {},
                "strategy_data": {},
                "gap_analysis": {},
                "ai_analysis": {},
                "performance_data": {},
                "competitor_data": {}
            }
    
    async def _execute_12_step_process(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute the complete 12-step process."""
        try:
            logger.info("🔄 Starting 12-step execution process")
            logger.info(f"📊 Context keys: {list(context.keys())}")
            
            # Execute steps sequentially by number
            for step_num in range(1, 13):
                step_key = f"step_{step_num:02d}"
                step = self.steps[step_key]
                
                logger.info(f"🎯 Executing {step.name} (Step {step_num}/12)")
                logger.info(f"📋 Step key: {step_key}")
                logger.info(f"🔧 Step type: {type(step)}")
                
                context["current_step"] = step_num
                context["phase"] = self._get_phase_for_step(step_num)
                
                logger.info(f"🚀 Calling step.run() for {step_key}")
                try:
                    step_result = await step.run(context)
                    logger.info(f"✅ Step {step_num} completed with result keys: {list(step_result.keys()) if step_result else 'None'}")
                except Exception as step_error:
                    logger.error(f"❌ Step {step_num} ({step.name}) execution failed - FAILING FAST")
                    logger.error(f"🚨 FAIL FAST: Step execution error: {str(step_error)}")
                    raise Exception(f"Step {step_num} ({step.name}) execution failed: {str(step_error)}")
                
                context["step_results"][step_key] = step_result
                context["quality_scores"][step_key] = step_result.get("quality_score", 0.0)
                
                # Update progress with correct signature
                logger.info(f"📊 Updating progress for {step_key}")
                self.progress_tracker.update_progress(step_key, step_result)
                
                # Update context with correct signature
                logger.info(f"🔄 Updating context for {step_key}")
                await self.context_manager.update_context(step_key, step_result)
                
                # Validate step result
                logger.info(f"🔍 Validating step result for {step_key}")
                validation_passed = await self._validate_step_result(step_key, step_result, context)
                
                if validation_passed:
                    logger.info(f"✅ {step.name} completed (Quality: {step_result.get('quality_score', 0.0):.2f})")
                else:
                    logger.error(f"❌ {step.name} validation failed - FAILING FAST")
                    # Update step result to indicate validation failure
                    step_result["validation_passed"] = False
                    step_result["status"] = "failed"
                    context["step_results"][step_key] = step_result
                    
                    # FAIL FAST: Stop execution and return error
                    error_message = f"Step {step_num} ({step.name}) validation failed. Stopping calendar generation."
                    logger.error(f"🚨 FAIL FAST: {error_message}")
                    raise Exception(error_message)
            
            # Generate final calendar
            logger.info("🎯 Generating final calendar from all steps")
            final_calendar = await self._generate_final_calendar(context)
            
            logger.info("✅ 12-step execution completed successfully")
            return final_calendar
            
        except Exception as e:
            logger.error(f"❌ Error in 12-step execution: {str(e)}")
            import traceback
            logger.error(f"📋 Traceback: {traceback.format_exc()}")
            raise
    

    
    async def _validate_step_result(
        self,
        step_name: str,
        step_result: Dict[str, Any],
        context: Dict[str, Any]
    ) -> bool:
        """Validate step result using quality gates."""
        try:
            logger.info(f"🔍 Validating {step_name} result")
            
            # Check if step_result exists
            if not step_result:
                logger.error(f"❌ {step_name}: Step result is None or empty")
                return False
            
            # Extract the actual result from the wrapped step response
            # The step_result from orchestrator contains the wrapped response from base step's run() method
            # We need to extract the actual result that the step's validate_result() method expects
            actual_result = step_result.get("result", step_result)
            
            # Get the step instance to call its validate_result method
            step_key = step_name
            if step_key in self.steps:
                step = self.steps[step_key]
                
                # Call the step's validate_result method with the actual result
                validation_passed = step.validate_result(actual_result)
                
                if validation_passed:
                    logger.info(f"✅ {step_name} validation passed using step's validate_result method")
                    return True
                else:
                    logger.error(f"❌ {step_name} validation failed using step's validate_result method")
                    return False
            else:
                logger.error(f"❌ {step_name}: Step not found in orchestrator steps")
                return False
            
        except Exception as e:
            logger.error(f"❌ {step_name} validation failed: {str(e)}")
            import traceback
            logger.error(f"📋 Validation traceback: {traceback.format_exc()}")
            return False
    
    async def _generate_final_calendar(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Generate final calendar from all step results."""
        try:
            logger.info("🎨 Generating final calendar from step results")

            # Extract the per-step output data using the real wrapped shapes
            # stored by the orchestrator (see _extract_step_output).
            step_results = context["step_results"]
            step_01 = self._extract_step_output(step_results, "step_01")
            step_02 = self._extract_step_output(step_results, "step_02")
            step_03 = self._extract_step_output(step_results, "step_03")
            step_09 = self._extract_step_output(step_results, "step_09")
            step_10 = self._extract_step_output(step_results, "step_10")

            # Step 12 already assembled the authoritative calendar.
            step_12_output = self._extract_step_output(step_results, "step_12")
            final_calendar = step_12_output.get("final_calendar", {})
            calendar_structure = final_calendar.get("calendar_structure", {})
            content_schedule = calendar_structure.get("content_schedule", [])
            calendar_framework = calendar_structure.get("calendar_framework", {})
            weekly_themes = calendar_framework.get("weekly_themes", []) or []

            daily_schedule = [
                self._project_schedule_day(day) for day in content_schedule
            ]

            content_pillars = self._as_str_list(step_01.get("content_pillars", []))
            platform_strategies = self._as_dict(step_03.get("platform_strategies", {}))
            content_mix = self._build_content_mix(
                daily_schedule,
                self._as_dict(step_03.get("content_mix", {})),
                content_pillars,
            )

            # QA-6: echo the confirmed-strategy digest the calendar was generated
            # against, so content scheduling visibly inherits the strategy.
            final_calendar_response = {
                "user_id": context.get("user_id", ""),
                "strategy_id": context.get("strategy_id"),
                "calendar_type": context.get("calendar_type", "monthly"),
                "industry": context.get("industry") or "",
                "business_size": context.get("business_size", "sme"),
                "generated_at": datetime.now(),
                "content_pillars": content_pillars,
                "platform_strategies": platform_strategies,
                "content_mix": content_mix,
                "daily_schedule": daily_schedule,
                "weekly_themes": weekly_themes,
                "content_recommendations": self._as_list_of_dicts(
                    step_09.get("final_recommendations")
                    or step_09.get("content_recommendations")
                    or [],
                    content_key="recommendation",
                ),
                "optimal_timing": self._as_dict(
                    step_03.get("optimal_timing") or {}, content_key="optimal_times"
                ),
                "performance_predictions": self._as_dict(
                    step_10.get("prediction_metrics")
                    or step_10.get("performance_metrics")
                    or {},
                ),
                "trending_topics": self._as_list_of_dicts(
                    step_02.get("trending_topics", []), content_key="topic"
                ),
                "repurposing_opportunities": [],
                "ai_insights": self._as_list_of_dicts(
                    step_01.get("strategic_insights", []), content_key="insight"
                ),
                "competitor_analysis": self._competitor_digest(step_01, step_02),
                "gap_analysis_insights": self._gap_analysis_digest(step_02),
                "strategy_insights": self._strategy_insights_digest(step_01),
                "onboarding_insights": self._as_dict(
                    context.get("user_data", {}).get("onboarding_data", {})
                ),
                "processing_time": 0.0,
                "ai_confidence": float(
                    final_calendar.get("quality_score")
                    or step_12_output.get("quality_metrics", {}).get("overall_quality_score")
                    or 0.8
                ),
                # QA-6: echo the confirmed-strategy digest the calendar was generated
                # against, so content scheduling visibly inherits the strategy.
                "strategy_digest": context.get("strategy_digest") or {},
                "quality_score": self._calculate_overall_quality_score(context.get("quality_scores", {})),
                "step_results_summary": {
                    step_key: {
                        "status": "completed",
                        "quality_score": context.get("quality_scores", {}).get(step_key, 0.0)
                    }
                    for step_key in self.steps
                }
            }

            logger.info("✅ Final calendar generated successfully")
            return final_calendar_response

        except Exception as e:
            logger.error(f"❌ Error generating final calendar: {str(e)}")
            raise

    def _extract_step_output(self, step_results: Dict[str, Any], step_key: str) -> Dict[str, Any]:
        """Extract the output data dict for a step from the orchestrator container.

        The orchestrator stores the wrapped ``base_step.run()`` response under
        ``step_results[step_key]``. Different step implementations wrap their
        data differently (under ``result``, ``result.results``, or
        ``result.output``), mirroring the shapes in step 12's normalization.
        """
        wrapped = step_results.get(step_key, {})
        if not isinstance(wrapped, dict):
            return {}
        payload = wrapped.get("result", wrapped)
        if not isinstance(payload, dict):
            return {}

        if step_key == "step_12":
            if payload.get("completed") is True and isinstance(payload.get("output"), dict):
                return payload["output"]
            return {}

        if isinstance(payload.get("output"), dict):
            return payload["output"]

        if step_key in ("step_01", "step_02", "step_03", "step_04", "step_08"):
            results = payload.get("results")
            if isinstance(results, dict):
                return results
            return payload

        if step_key == "step_11":
            nested = payload.get("step_11")
            if isinstance(nested, dict):
                return nested
            return payload

        return payload

    def _project_schedule_day(self, day: Dict[str, Any]) -> Dict[str, Any]:
        """Project a step-12 content-schedule day into the response contract.

        ``content_items`` aliases the assembled ``content_pieces`` so the
        persistence layer can materialize ``CalendarEvent`` rows from it.
        """
        content_pieces = day.get("content_pieces", [])
        return {
            "date": day.get("date"),
            "week_number": day.get("week_number"),
            "theme": day.get("theme", "General"),
            "content_items": content_pieces,
            "content_pieces": content_pieces,
            "platform_distribution": self._as_dict(day.get("platform_distribution", {})),
            "quality_metrics": day.get("quality_metrics"),
            "optimization_notes": day.get("optimization_notes", []),
        }

    def _build_content_mix(self, daily_schedule: List[Dict[str, Any]], raw_mix: Dict[str, Any], content_pillars: List[str]) -> Dict[str, float]:
        """Derive a contract-safe ``Dict[str, float]`` content mix.

        Merges the step-3 mix (if already numeric) with fractions computed
        from the scheduled content pieces; falls back to an even split over
        content pillars when nothing is scheduled.
        """
        mix: Dict[str, float] = {}
        for key, value in raw_mix.items():
            if isinstance(value, (int, float)) and not isinstance(value, bool):
                mix[str(key)] = float(value)

        counts: Dict[str, int] = {}
        for day in daily_schedule:
            for item in day.get("content_items", []):
                content_type = item.get("content_type") or item.get("type") or "misc"
                counts[content_type] = counts.get(content_type, 0) + 1

        if counts:
            total = float(sum(counts.values()))
            mix.update({key: round(value / total, 4) for key, value in counts.items()})

        if not mix and content_pillars:
            split = round(1.0 / len(content_pillars), 4)
            mix = {pillar: split for pillar in content_pillars}

        return mix

    def _competitor_digest(self, step_01: Dict[str, Any], step_02: Dict[str, Any]) -> Dict[str, Any]:
        """Merge step-1 competitive landscape and step-2 competitor insights."""
        digest = {}
        landscape = self._as_dict(step_01.get("competitive_landscape", {}))
        insights = self._as_dict(step_02.get("competitor_insights", {}))
        for source in (insights, landscape):
            for key, value in source.items():
                digest.setdefault(key, value)
        return digest

    def _gap_analysis_digest(self, step_02: Dict[str, Any]) -> Dict[str, Any]:
        """Shape step-2 gap analysis into the response's insights container."""
        digest = {}
        for key in ("content_gaps", "keyword_opportunities", "competitor_insights", "recommendations"):
            value = step_02.get(key)
            if value is not None:
                digest[key] = value
        return digest

    def _strategy_insights_digest(self, step_01: Dict[str, Any]) -> Dict[str, Any]:
        """Shape step-1 strategy analysis into the response's insights digest."""
        return {
            "business_goals": self._as_list(step_01.get("business_goals", [])),
            "content_pillars": self._as_str_list(step_01.get("content_pillars", [])),
            "market_positioning": step_01.get("market_positioning", ""),
            "goal_alignment_score": step_01.get("goal_alignment_score", 0.0),
            "strategy_coherence": step_01.get("strategy_coherence", 0.0),
        }

    def _as_str_list(self, value: Any) -> List[str]:
        if not isinstance(value, list):
            return []
        return [str(item) for item in value if item is not None]

    def _as_list(self, value: Any) -> List[Any]:
        return list(value) if isinstance(value, list) else []

    def _as_list_of_dicts(self, value: Any, content_key: str = "item") -> List[Dict[str, Any]]:
        """Normalize a list into a list of dicts (contract-safe for ``List[Dict]``)."""
        items = []
        if isinstance(value, dict):
            value = [value]
        if not isinstance(value, list):
            return items
        for item in value:
            if isinstance(item, dict):
                items.append(item)
            elif item is not None:
                items.append({content_key: str(item)})
        return items

    def _as_dict(self, value: Any, content_key: str = "value") -> Dict[str, Any]:
        """Normalize a value into a dict (contract-safe for ``Dict[str, Any]``)."""
        if isinstance(value, dict):
            return value
        if isinstance(value, list):
            return {content_key: value}
        if isinstance(value, (str, int, float)) and value not in ("", None):
            return {content_key: value}
        return {}
    
    def _calculate_overall_quality_score(self, quality_scores: Dict[str, float]) -> float:
        scores = [s for s in quality_scores.values() if s > 0.0]
        return sum(scores) / len(scores) if scores else 0.0

    async def get_progress(self) -> Dict[str, Any]:
        return self.progress_tracker.get_progress()
    
    async def get_health_status(self) -> Dict[str, Any]:
        """Get health status of the orchestrator."""
        return {
            "service": "12_step_prompt_chaining",
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "framework_version": "12-step-v1.0",
            "steps_configured": len(self.steps),
            "phases_configured": len(self.phases),
            "components": {
                "step_manager": "ready",
                "context_manager": "ready",
                "progress_tracker": "ready",
                "error_handler": "ready"
            }
        }
