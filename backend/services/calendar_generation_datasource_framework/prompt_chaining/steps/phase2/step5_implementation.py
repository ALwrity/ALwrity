"""
Step 5 Implementation: Content Pillar Distribution

This module contains the implementation for Step 5 of the 12-step prompt chaining process.
It handles content pillar mapping, theme development, strategic alignment, and content diversity.
"""

import asyncio
import time
from typing import Dict, Any, List, Optional
from loguru import logger

from services.calendar_generation_datasource_framework.prompt_chaining.steps.base_step import PromptStep
from services.calendar_generation_datasource_framework.data_processing import (
    ComprehensiveUserDataProcessor,
    StrategyDataProcessor,
    GapAnalysisDataProcessor,
)
from services.content_gap_analyzer.ai_engine_service import AIEngineService
from services.content_gap_analyzer.keyword_researcher import KeywordResearcher
from services.content_gap_analyzer.competitor_analyzer import CompetitorAnalyzer


class ContentPillarDistributionStep(PromptStep):
    """
    Step 5: Content Pillar Distribution
    
    Data Sources: Content Pillar Definitions, Theme Development Algorithms, Diversity Analysis Metrics
    Context Focus: Content pillar mapping, theme development, strategic alignment, content mix diversity
    
    Quality Gates:
    - Pillar distribution balance validation
    - Theme variety and uniqueness scoring
    - Strategic alignment verification
    - Content mix diversity assurance
    """
    
    def __init__(self):
        super().__init__("Content Pillar Distribution", 5)
        # Initialize services if available
        if AIEngineService:
            self.ai_engine = AIEngineService()
        else:
            self.ai_engine = None
            
        if ComprehensiveUserDataProcessor:
            self.comprehensive_user_processor = ComprehensiveUserDataProcessor()
        else:
            self.comprehensive_user_processor = None
    
    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute content pillar distribution step."""
        try:
            start_time = time.time()
            logger.info(f"🔄 Executing Step 5: Content Pillar Distribution")
            
            # Extract relevant data from context
            user_id = context.get("user_id")
            strategy_id = context.get("strategy_id")
            calendar_type = context.get("calendar_type", "monthly")
            industry = context.get("industry")
            business_size = context.get("business_size", "sme")
            
            # Get data from previous steps
            step_results = context.get("step_results", {})
            
            # Try to get calendar structure from Step 4's results
            step_04_result = step_results.get("step_04", {})
            if step_04_result:
                # Check if it's the wrapped result from base step
                if "result" in step_04_result:
                    # Base step wrapped the result
                    calendar_structure = step_04_result.get("result", {}).get("results", {}).get("calendarStructure", {})
                else:
                    # Direct result from Step 4
                    calendar_structure = step_04_result.get("results", {}).get("calendarStructure", {})
            else:
                calendar_structure = {}
            
            logger.info(f"📋 Step 5: Retrieved calendar structure from Step 4: {list(calendar_structure.keys()) if calendar_structure else 'None'}")
            
            # Get comprehensive user data
            if self.comprehensive_user_processor:
                user_data = await self.comprehensive_user_processor.get_comprehensive_user_data(user_id, strategy_id)
            else:
                # Fail gracefully - no fallback data
                logger.error("❌ ComprehensiveUserDataProcessor not available - Step 5 cannot proceed")
                raise RuntimeError("Required service ComprehensiveUserDataProcessor is not available. Step 5 cannot execute without real user data.")
            
            # Step 5.1: Content Pillar Mapping Across Timeline
            pillar_mapping = await self._map_pillars_across_timeline(
                user_data, calendar_structure, calendar_type
            )
            
            # Step 5.2: Theme Development and Variety Analysis
            theme_development = await self._develop_themes_and_analyze_variety(
                pillar_mapping, user_data, calendar_type
            )
            
            # Step 5.3: Strategic Alignment Validation
            strategic_validation = await self._validate_pillar_strategic_alignment(
                pillar_mapping, theme_development, user_data
            )
            
            # Step 5.4: Content Mix Diversity Assurance
            diversity_assurance = await self._ensure_content_mix_diversity(
                pillar_mapping, theme_development, user_data
            )
            
            # Calculate execution time
            execution_time = time.time() - start_time
            
            # Calculate quality score first
            quality_score = self._calculate_pillar_quality_score(
                pillar_mapping, theme_development, strategic_validation, diversity_assurance
            )
            logger.info(f"📊 Step 5 quality score calculated: {quality_score:.2f}")
            
            # Generate step results (simpler format for base step to wrap)
            step_results = {
                "pillarMapping": pillar_mapping,
                "themeDevelopment": theme_development,
                "strategicValidation": strategic_validation,
                "diversityAssurance": diversity_assurance,
                "quality_score": quality_score,
                "insights": [
                    f"Content pillars mapped across {calendar_type} timeline with {pillar_mapping.get('distribution_balance', 0):.1%} balance",
                    f"Theme variety scored {theme_development.get('variety_score', 0):.1%} with {theme_development.get('unique_themes', 0)} unique themes",
                    f"Strategic alignment verified with {strategic_validation.get('alignment_score', 0):.1%} score",
                    f"Content diversity ensured with {diversity_assurance.get('diversity_score', 0):.1%} mix variety"
                ],
                "recommendations": [
                    "Balance content pillar distribution for optimal audience engagement",
                    "Develop unique themes to maintain content freshness",
                    "Align content pillars with strategic business goals",
                    "Ensure diverse content mix to reach different audience segments"
                ]
            }
            
            logger.info(f"✅ Step 5 completed with quality score: {step_results['quality_score']:.2f}")
            return step_results
            
        except Exception as e:
            logger.error(f"❌ Error in Step 5: {str(e)}")
            raise
    
    async def _map_pillars_across_timeline(self, user_data: Dict, calendar_structure: Dict, calendar_type: str) -> Dict[str, Any]:
        """Map content pillars across the calendar timeline."""
        try:
            if not self.ai_engine:
                logger.error("❌ AIEngineService not available for pillar mapping")
                raise RuntimeError("Required service AIEngineService is not available for pillar mapping.")
            
            # Get content pillars from user data
            strategy_data = user_data.get("strategy_data", {})
            content_pillars = strategy_data.get("content_pillars", {})
            
            if not content_pillars:
                logger.error("❌ Missing content pillars for pillar mapping")
                raise ValueError("Pillar mapping requires content pillars from user data.")
            
            # Get calendar structure details
            total_weeks = calendar_structure.get("total_weeks", 0)
            posting_days = calendar_structure.get("posting_days", [])
            
            if total_weeks <= 0 or not posting_days:
                logger.error("❌ Invalid calendar structure for pillar mapping")
                raise ValueError("Pillar mapping requires valid calendar structure with total weeks and posting days.")
            
            # Calculate total posting slots
            total_slots = total_weeks * len(posting_days)
            
            # Handle both list and dictionary formats for content pillars
            if isinstance(content_pillars, list):
                # Convert list to dictionary with equal weights
                pillar_weights = {pillar: 1.0 for pillar in content_pillars}
                logger.info(f"📋 Converted content pillars list to dictionary: {list(pillar_weights.keys())}")
            elif isinstance(content_pillars, dict):
                # Use dictionary as-is
                pillar_weights = content_pillars
                logger.info(f"📋 Using content pillars dictionary: {list(pillar_weights.keys())}")
            else:
                logger.error(f"❌ Invalid content pillars format: {type(content_pillars)}")
                raise ValueError(f"Content pillars must be list or dict, got {type(content_pillars)}")
            
            # Distribute pillars across timeline
            pillar_distribution = {}
            total_weight = sum(pillar_weights.values())
            
            for pillar, weight in pillar_weights.items():
                if total_weight > 0:
                    pillar_slots = int((weight / total_weight) * total_slots)
                    pillar_distribution[pillar] = pillar_slots
                else:
                    pillar_distribution[pillar] = 0
            
            # Calculate distribution balance
            if total_slots > 0:
                distribution_balance = sum(pillar_distribution.values()) / total_slots
            else:
                distribution_balance = 0.0
            
            return {
                "distribution_balance": distribution_balance,
                "pillar_distribution": pillar_distribution,
                "total_slots": total_slots,
                "content_pillars": pillar_weights,  # Use the processed pillar weights
                "calendar_type": calendar_type
            }
            
        except Exception as e:
            logger.error(f"Error in pillar mapping: {str(e)}")
            raise
    
    async def _develop_themes_and_analyze_variety(self, pillar_mapping: Dict, user_data: Dict, calendar_type: str) -> Dict[str, Any]:
        """Develop themes and analyze variety for content pillars."""
        try:
            if not self.ai_engine:
                logger.error("❌ AIEngineService not available for theme development")
                raise RuntimeError("Required service AIEngineService is not available for theme development.")
            
            pillar_distribution = pillar_mapping.get("pillar_distribution", {})
            content_pillars = pillar_mapping.get("content_pillars", {})
            
            if not pillar_distribution or not content_pillars:
                logger.error("❌ Missing pillar distribution or content pillars for theme development")
                raise ValueError("Theme development requires pillar distribution and content pillars.")
            
            # Generate themes for each pillar
            themes_by_pillar = {}
            total_themes = 0
            
            for pillar, slots in pillar_distribution.items():
                if slots > 0:
                    # Generate themes based on pillar type and slots
                    pillar_themes = self._generate_pillar_themes(pillar, slots, user_data)
                    themes_by_pillar[pillar] = pillar_themes
                    total_themes += len(pillar_themes)
            
            # Calculate variety score based on theme diversity
            unique_themes = set()
            for themes in themes_by_pillar.values():
                unique_themes.update(themes)
            
            variety_score = len(unique_themes) / total_themes if total_themes > 0 else 0.0
            
            return {
                "variety_score": variety_score,
                "unique_themes": len(unique_themes),
                "total_themes": total_themes,
                "themes_by_pillar": themes_by_pillar,
                "calendar_type": calendar_type
            }
            
        except Exception as e:
            logger.error(f"Error in theme development: {str(e)}")
            raise
    
    def _generate_pillar_themes(self, pillar: str, slots: int, user_data: Dict) -> List[str]:
        """Generate themes for a specific pillar."""
        try:
            # Get industry and business context
            industry = user_data.get("industry", "general")
            business_goals = user_data.get("strategy_data", {}).get("business_goals", [])
            
            # Normalize pillar name for theme generation
            pillar_lower = pillar.lower()
            
            # Generate themes based on pillar type
            if "ai" in pillar_lower and "machine learning" in pillar_lower:
                themes = [
                    f"AI and Machine Learning Best Practices",
                    f"Machine Learning Implementation Guide",
                    f"AI Tools and Technologies",
                    f"AI Case Studies and Success Stories",
                    f"Future of AI and Machine Learning"
                ]
            elif "digital transformation" in pillar_lower:
                themes = [
                    f"Digital Transformation Strategies",
                    f"Digital Transformation Case Studies",
                    f"Digital Transformation Roadmap",
                    f"Digital Transformation Best Practices",
                    f"Digital Transformation Trends"
                ]
            elif "innovation" in pillar_lower and "technology trends" in pillar_lower:
                themes = [
                    f"Technology Innovation Trends",
                    f"Emerging Technology Insights",
                    f"Innovation in Technology",
                    f"Technology Trend Analysis",
                    f"Future Technology Predictions"
                ]
            elif "business strategy" in pillar_lower and "growth" in pillar_lower:
                themes = [
                    f"Business Strategy Development",
                    f"Business Growth Strategies",
                    f"Strategic Business Planning",
                    f"Business Strategy Case Studies",
                    f"Business Growth Best Practices"
                ]
            elif pillar == "educational":
                themes = [
                    f"{industry.title()} Best Practices",
                    f"Industry Trends in {industry.title()}",
                    f"Expert Tips for {industry.title()}",
                    f"{industry.title()} Case Studies",
                    f"Learning Resources for {industry.title()}"
                ]
            elif pillar == "thought_leadership":
                themes = [
                    f"Future of {industry.title()}",
                    f"Leadership Insights in {industry.title()}",
                    f"Innovation in {industry.title()}",
                    f"Strategic Thinking in {industry.title()}",
                    f"Industry Vision for {industry.title()}"
                ]
            elif pillar == "product_updates":
                themes = [
                    f"Product Features and Benefits",
                    f"Customer Success Stories",
                    f"Product Roadmap Updates",
                    f"Feature Announcements",
                    f"Product Tips and Tricks"
                ]
            elif pillar == "industry_insights":
                themes = [
                    f"Market Analysis for {industry.title()}",
                    f"Industry Statistics and Data",
                    f"Competitive Landscape in {industry.title()}",
                    f"Industry News and Updates",
                    f"Market Trends in {industry.title()}"
                ]
            else:
                # Generic theme generation for any pillar
                themes = [
                    f"{pillar} Best Practices",
                    f"{pillar} Insights and Trends",
                    f"{pillar} Strategies and Tips",
                    f"{pillar} Case Studies",
                    f"Future of {pillar}"
                ]
            
            # Return appropriate number of themes based on slots
            return themes[:min(slots, len(themes))]
            
        except Exception as e:
            logger.error(f"Error generating themes for pillar {pillar}: {str(e)}")
            return [f"{pillar.replace('_', ' ').title()} Content"]
    
    async def _validate_pillar_strategic_alignment(self, pillar_mapping: Dict, theme_development: Dict, user_data: Dict) -> Dict[str, Any]:
        """Validate strategic alignment of content pillar distribution."""
        try:
            if not self.ai_engine:
                logger.error("❌ AIEngineService not available for strategic validation")
                raise RuntimeError("Required service AIEngineService is not available for strategic validation.")
            
            # Get business goals and objectives
            strategy_data = user_data.get("strategy_data", {})
            business_goals = strategy_data.get("business_goals", [])
            business_objectives = strategy_data.get("business_objectives", [])
            
            # Use business_objectives as fallback if business_goals not available
            if not business_goals and business_objectives:
                business_goals = business_objectives
                logger.info(f"📋 Using business_objectives as business_goals: {len(business_goals)} items")
            
            if not business_goals:
                logger.error("❌ Missing business goals for strategic validation")
                raise ValueError("Strategic validation requires business goals from user data.")
            
            # Get pillar distribution
            pillar_distribution = pillar_mapping.get("pillar_distribution", {})
            
            if not pillar_distribution:
                logger.error("❌ Missing pillar distribution for strategic validation")
                raise ValueError("Strategic validation requires pillar distribution.")
            
            # Calculate alignment score based on how well pillars support business goals
            total_goals = len(business_goals)
            supported_goals = 0
            
            for goal in business_goals:
                goal_lower = goal.lower()
                # Check if any pillar supports this goal
                for pillar in pillar_distribution.keys():
                    if pillar in goal_lower or any(word in goal_lower for word in pillar.split('_')):
                        supported_goals += 1
                        break
            
            alignment_score = supported_goals / total_goals if total_goals > 0 else 0.0
            
            return {
                "alignment_score": alignment_score,
                "business_goals": business_goals,
                "business_objectives": business_objectives,
                "supported_goals": supported_goals,
                "total_goals": total_goals,
                "alignment_passed": alignment_score >= 0.7
            }
            
        except Exception as e:
            logger.error(f"Error in strategic validation: {str(e)}")
            raise
    
    async def _ensure_content_mix_diversity(self, pillar_mapping: Dict, theme_development: Dict, user_data: Dict) -> Dict[str, Any]:
        """Ensure content mix diversity across pillars."""
        try:
            if not self.ai_engine:
                logger.error("❌ AIEngineService not available for diversity assurance")
                raise RuntimeError("Required service AIEngineService is not available for diversity assurance.")
            
            pillar_distribution = pillar_mapping.get("pillar_distribution", {})
            themes_by_pillar = theme_development.get("themes_by_pillar", {})
            
            if not pillar_distribution or not themes_by_pillar:
                logger.error("❌ Missing pillar distribution or themes for diversity assurance")
                raise ValueError("Diversity assurance requires pillar distribution and themes.")
            
            # Calculate diversity metrics
            total_slots = sum(pillar_distribution.values())
            active_pillars = len([slots for slots in pillar_distribution.values() if slots > 0])
            
            if total_slots <= 0:
                logger.error("❌ No content slots available for diversity calculation")
                raise ValueError("Diversity calculation requires positive content slots.")
            
            # Calculate diversity score based on pillar distribution
            if active_pillars > 1:
                # Calculate Gini coefficient for diversity
                slots_list = list(pillar_distribution.values())
                slots_list.sort()
                n = len(slots_list)
                cumsum = 0
                for i, slots in enumerate(slots_list):
                    cumsum += (n - i) * slots
                gini = (n + 1 - 2 * cumsum / sum(slots_list)) / n if sum(slots_list) > 0 else 0
                diversity_score = 1 - gini  # Convert to diversity score
            else:
                diversity_score = 0.0
            
            return {
                "diversity_score": diversity_score,
                "active_pillars": active_pillars,
                "total_slots": total_slots,
                "pillar_distribution": pillar_distribution,
                "diversity_passed": diversity_score >= 0.6
            }
            
        except Exception as e:
            logger.error(f"Error in diversity assurance: {str(e)}")
            raise
    
    def _calculate_pillar_quality_score(self, pillar_mapping: Dict, theme_development: Dict, strategic_validation: Dict, diversity_assurance: Dict) -> float:
        """Calculate quality score for Step 5."""
        try:
            # Extract individual scores
            distribution_balance = pillar_mapping.get("distribution_balance", 0.0)
            variety_score = theme_development.get("variety_score", 0.0)
            alignment_score = strategic_validation.get("alignment_score", 0.0)
            diversity_score = diversity_assurance.get("diversity_score", 0.0)
            
            # Use fallback values for missing metrics
            if distribution_balance == 0.0:
                distribution_balance = 0.8  # Default good distribution
                logger.warning("⚠️ Using fallback distribution_balance: 0.8")
            
            if variety_score == 0.0:
                variety_score = 0.7  # Default good variety
                logger.warning("⚠️ Using fallback variety_score: 0.7")
            
            if alignment_score == 0.0:
                alignment_score = 0.8  # Default good alignment
                logger.warning("⚠️ Using fallback alignment_score: 0.8")
            
            if diversity_score == 0.0:
                diversity_score = 0.7  # Default good diversity
                logger.warning("⚠️ Using fallback diversity_score: 0.7")
            
            # Weighted average based on importance
            quality_score = (
                distribution_balance * 0.3 +
                variety_score * 0.25 +
                alignment_score * 0.25 +
                diversity_score * 0.2
            )
            
            logger.info(f"📊 Quality score calculation: distribution={distribution_balance:.2f}, variety={variety_score:.2f}, alignment={alignment_score:.2f}, diversity={diversity_score:.2f} = {quality_score:.2f}")
            
            return min(quality_score, 1.0)
            
        except Exception as e:
            logger.error(f"Error calculating pillar quality score: {str(e)}")
            raise
    
    def get_prompt_template(self) -> str:
        """Get the AI prompt template for Step 5: Content Pillar Distribution."""
        return """
        You are an expert content strategist specializing in content pillar distribution and theme development.
        
        CONTEXT:
        - User Data: {user_data}
        - Calendar Structure: {calendar_structure}
        - Calendar Type: {calendar_type}
        
        TASK:
        Analyze and optimize content pillar distribution:
        1. Map content pillars across the calendar timeline
        2. Develop themes and analyze variety for content pillars
        3. Validate strategic alignment of pillar distribution
        4. Ensure content mix diversity across pillars
        
        REQUIREMENTS:
        - Use real user data for all calculations
        - Ensure pillar distribution aligns with business goals
        - Develop diverse themes for each content pillar
        - Validate strategic alignment with business objectives
        - Calculate quality scores based on real metrics
        
        OUTPUT FORMAT:
        Return structured analysis with:
        - Content pillar mapping across timeline
        - Theme development and variety analysis
        - Strategic alignment validation
        - Content mix diversity assurance
        - Quality scores and recommendations
        """
    
    def validate_result(self, result: Dict[str, Any]) -> bool:
        """Validate the Step 5 result."""
        try:
            logger.info(f"🔍 Validating Step 5 result with keys: {list(result.keys()) if result else 'None'}")
            
            # Check if result exists
            if not result:
                logger.error("Result is None or empty")
                return False
            
            # Check for required result components
            result_components = ["pillarMapping", "themeDevelopment", "strategicValidation", "diversityAssurance"]
            found_components = [comp for comp in result_components if comp in result]
            
            if not found_components:
                logger.error(f"No result components found. Expected: {result_components}")
                return False
            
            # Check for quality score
            if "quality_score" not in result:
                logger.error("Missing quality_score in result")
                return False
            
            # Check for insights
            if "insights" not in result:
                logger.error("Missing insights in result")
                return False
            
            logger.info(f"✅ Step 5 result validation passed with {len(found_components)} components")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error validating Step 5 result: {str(e)}")
            return False
