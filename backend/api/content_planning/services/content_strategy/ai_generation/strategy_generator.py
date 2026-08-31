"""
AI-Powered Strategy Generation Service
Generates comprehensive content strategies using AI with enhanced insights and recommendations.

Grounding note
--------------
generate_comprehensive_strategy() self-validates its output via _validate_grounding()
before returning, attaching grounding_validation + grounding_status to
strategy_metadata. This protects every caller of the generator (the sync endpoint,
optimize-existing-strategy, and any future caller) even though the endpoints run
their own enforcement-aware validation too — gates are deterministic, so the
double pass on the sync path yields identical results.

All five component generators (_generate_strategic_insights,
_generate_competitive_analysis, _generate_performance_predictions,
_generate_implementation_roadmap, _generate_risk_assessment) accept a user_id
kwarg and forward it to the AI service call. generate_comprehensive_strategy
passes user_id= to each — adding a new component generator without the kwarg
will crash the comprehensive flow (regression test:
tests/api/test_strategy_integration.py::TestStrategyGeneratorGrounding::
test_component_methods_accept_user_id_kwarg).
"""

import json
import logging
from typing import Any, Dict, List, Optional
from datetime import datetime
from dataclasses import dataclass

from services.ai_service_manager import AIServiceManager, AIServiceType
from services.intelligence.agents.quality_gates import validate_strategy_grounding
from ..autofill.ai_structured_autofill import AIStructuredAutofillService

logger = logging.getLogger(__name__)

@dataclass
class StrategyGenerationConfig:
    """Configuration for strategy generation."""
    include_competitive_analysis: bool = True
    include_content_calendar: bool = True
    include_performance_predictions: bool = True
    include_implementation_roadmap: bool = True
    include_risk_assessment: bool = True
    max_content_pieces: int = 50
    timeline_months: int = 12

class AIStrategyGenerator:
    """
    AI-Powered Content Strategy Generator
    
    Generates comprehensive content strategies including:
    - Strategic field autofill (leveraging existing 100% success system)
    - Competitive analysis and positioning
    - Content calendar and publishing schedule
    - Performance predictions and KPIs
    - Implementation roadmap
    - Risk assessment and mitigation
    """

    def __init__(self, config: Optional[StrategyGenerationConfig] = None):
        """Initialize the AI strategy generator."""
        self.config = config or StrategyGenerationConfig()
        self.ai_manager = AIServiceManager()
        self.autofill_service = AIStructuredAutofillService()
        self.logger = logger

    async def generate_comprehensive_strategy(
        self, 
        user_id: int, 
        context: Dict[str, Any],
        strategy_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate a comprehensive content strategy using AI.
        
        Args:
            user_id: User ID for personalization
            context: User context and onboarding data
            strategy_name: Optional custom strategy name
            
        Returns:
            Comprehensive strategy with all components (EXCLUDING content calendar)
            
        Raises:
            RuntimeError: If any AI component fails to generate
        """
        try:
            self.logger.info(f"🚀 Generating comprehensive AI strategy for user: {user_id}")
            
            # Track which components failed during generation
            failed_components = []
            
            # Step 1: Generate base strategy fields (using existing autofill system)
            base_strategy = await self._generate_base_strategy_fields(user_id, context)
            
            # Step 2: Generate strategic insights and recommendations
            strategic_insights = await self._generate_strategic_insights(base_strategy, context, user_id=user_id)
            if strategic_insights.get("ai_generation_failed"):
                failed_components.append("strategic_insights")
            
            # Step 3: Generate competitive analysis
            competitive_analysis = await self._generate_competitive_analysis(base_strategy, context, user_id=user_id)
            if competitive_analysis.get("ai_generation_failed"):
                failed_components.append("competitive_analysis")
            
            # Step 4: Generate performance predictions
            performance_predictions = await self._generate_performance_predictions(base_strategy, context, user_id=user_id)
            if performance_predictions.get("ai_generation_failed"):
                failed_components.append("performance_predictions")
            
            # Step 5: Generate implementation roadmap
            implementation_roadmap = await self._generate_implementation_roadmap(base_strategy, context, user_id=user_id)
            if implementation_roadmap.get("ai_generation_failed"):
                failed_components.append("implementation_roadmap")
            
            # Step 6: Generate risk assessment
            risk_assessment = await self._generate_risk_assessment(base_strategy, context, user_id=user_id)
            if risk_assessment.get("ai_generation_failed"):
                failed_components.append("risk_assessment")
            
            # Step 7: Compile comprehensive strategy (NO CONTENT CALENDAR)
            comprehensive_strategy = {
                "strategy_metadata": {
                    "generated_at": datetime.utcnow().isoformat(),
                    "user_id": user_id,
                    "strategy_name": strategy_name or f"AI-Generated Strategy {datetime.utcnow().strftime('%Y-%m-%d')}",
                    "generation_version": "2.0",
                    "ai_model": "gemini-pro",
                    "personalization_level": "high",
                    "ai_generated": True,
                    "comprehensive": True,
                    "content_calendar_ready": False,  # Indicates calendar needs to be generated separately
                    "failed_components": failed_components,
                    "generation_status": "partial" if failed_components else "complete"
                },
                "base_strategy": base_strategy,
                "strategic_insights": strategic_insights,
                "competitive_analysis": competitive_analysis,
                "performance_predictions": performance_predictions,
                "implementation_roadmap": implementation_roadmap,
                "risk_assessment": risk_assessment,
                "summary": {
                    "estimated_roi": performance_predictions.get("estimated_roi", "15-25%"),
                    "implementation_timeline": implementation_roadmap.get("total_duration", "12 months"),
                    "risk_level": risk_assessment.get("overall_risk_level", "Medium"),
                    "success_probability": performance_predictions.get("success_probability", "85%"),
                    "next_step": "Review strategy and generate content calendar"
                }
            }
            
            if failed_components:
                self.logger.warning(f"⚠️ Strategy generated with partial AI components. Failed: {failed_components}")
                self.logger.info(f"✅ Partial AI strategy generated successfully for user: {user_id}")
            else:
                self.logger.info(f"✅ Comprehensive AI strategy generated successfully for user: {user_id}")
            
            # Quality gate: validate grounding before returning (soft gate).
            grounding_result = self._validate_grounding(comprehensive_strategy, context)
            comprehensive_strategy["strategy_metadata"]["grounding_validation"] = grounding_result
            if grounding_result.get("status") == "error":
                comprehensive_strategy["strategy_metadata"]["grounding_status"] = "error"
            else:
                comprehensive_strategy["strategy_metadata"]["grounding_status"] = (
                    "validated" if grounding_result.get("passed") else "partial"
                )
            
            return comprehensive_strategy
            
        except Exception as e:
            self.logger.error(f"❌ Error generating comprehensive strategy: {str(e)}")
            raise RuntimeError(f"Failed to generate comprehensive strategy: {str(e)}")

    def _validate_grounding(self, strategy_data: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """Validate the generated strategy is grounded in onboarding data (soft gate).

        Runs the intelligence quality gates (persona, competitor, analytics,
        data-quality grounding) against the compiled strategy. Soft mode:
        gate errors never break strategy generation.

        Args:
            strategy_data: The compiled comprehensive strategy dict.
            context: Generation context containing ``onboarding_data``.

        Returns:
            The grounding validation result dict.
        """
        try:
            onboarding_context = context.get("onboarding_data") or {}
            result = validate_strategy_grounding(strategy_data, onboarding_context)
            if not result.get("passed"):
                self.logger.warning(
                    f"⚠️ Strategy grounding validation failed | score={result.get('score', 0):.2f} "
                    f"| violations={len(result.get('violations', []))}"
                )
            else:
                self.logger.info(
                    f"✅ Strategy grounding validated | score={result.get('score', 0):.2f}"
                )
            return result
        except Exception as e:
            self.logger.error(f"❌ Grounding validation error (non-blocking): {str(e)}")
            return {"passed": True, "score": 0.0, "status": "error", "error": str(e)}

    async def _generate_base_strategy_fields(
        self, 
        user_id: int, 
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate base strategy fields using existing autofill system."""
        try:
            self.logger.info(f"Generating base strategy fields for user: {user_id}")
            
            # Use existing autofill service (100% success rate)
            autofill_result = await self.autofill_service.generate_autofill_fields(user_id, context)
            
            # Extract the fields from autofill result
            base_strategy = autofill_result.get("fields", {})
            
            # Add generation metadata
            base_strategy["generation_metadata"] = {
                "generated_by": "ai_autofill_system",
                "success_rate": autofill_result.get("success_rate", 100),
                "personalized": autofill_result.get("personalized", True),
                "data_sources": autofill_result.get("data_sources", [])
            }
            
            return base_strategy
            
        except Exception as e:
            self.logger.error(f"Error generating base strategy fields: {str(e)}")
            raise

    async def _generate_strategic_insights(self, base_strategy: Dict[str, Any], context: Dict[str, Any], user_id: Optional[int] = None, ai_manager: Optional[Any] = None) -> Dict[str, Any]:
        """Generate strategic insights using AI."""
        try:
            logger.info("🧠 Generating strategic insights...")
            
            # Use provided AI manager or create default one
            if ai_manager is None:
                from services.ai_service_manager import AIServiceManager
                ai_manager = AIServiceManager()
            
            prompt = f"""
            Generate comprehensive strategic insights for content strategy based on the following context:
            
            CONTEXT:
            {json.dumps(context, indent=2)}
            
            BASE STRATEGY:
            {json.dumps(base_strategy, indent=2)}
            
            Please provide strategic insights including:
            1. Market positioning analysis
            2. Content opportunity identification
            3. Competitive advantage mapping
            4. Growth potential assessment
            5. Strategic recommendations
            
            Format as structured JSON with insights, reasoning, and confidence levels.
            """
            
            schema = {
                "type": "object",
                "properties": {
                    "insights": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "type": {"type": "string"},
                                "insight": {"type": "string"},
                                "reasoning": {"type": "string"},
                                "priority": {"type": "string"},
                                "estimated_impact": {"type": "string"},
                                "implementation_time": {"type": "string"},
                                "confidence_level": {"type": "string"}
                            }
                        }
                    }
                }
            }
            
            response = await ai_manager.execute_structured_json_call(
                AIServiceType.STRATEGIC_INTELLIGENCE, 
                prompt, 
                schema,
                user_id=str(user_id) if user_id else None
            )
            
            if not response or not response.get("data"):
                raise RuntimeError("AI service returned empty strategic insights")
            
            logger.info("✅ Strategic insights generated successfully")
            
            # Log the raw AI response for debugging
            logger.info(f"🔍 Raw AI response for strategic insights: {json.dumps(response.get('data', {}), indent=2)}")
            
            # Transform AI response to frontend format
            transformed_response = self._transform_ai_response_to_frontend_format(response.get("data", {}), "strategic_insights")
            
            # Log the transformed response for debugging
            logger.info(f"🔄 Transformed strategic insights: {json.dumps(transformed_response, indent=2)}")
            
            return transformed_response
            
        except Exception as e:
            logger.warning(f"⚠️ AI service overload or error during strategic insights: {str(e)}")
            logger.info("🔄 Continuing strategy generation without strategic insights...")
            
            # Return empty strategic insights to allow strategy generation to continue
            return {
                "insights": [],
                "ai_generation_failed": True,
                "failure_reason": str(e)
            }

    async def _generate_competitive_analysis(self, base_strategy: Dict[str, Any], context: Dict[str, Any], user_id: Optional[int] = None, ai_manager: Optional[Any] = None) -> Dict[str, Any]:
        """Generate competitive analysis using AI."""
        try:
            logger.info("🔍 Generating competitive analysis...")
            
            # Use provided AI manager or create default one
            if ai_manager is None:
                from services.ai_service_manager import AIServiceManager
                ai_manager = AIServiceManager()
            
            prompt = f"""
            Generate comprehensive competitive analysis for content strategy based on the following context:
            
            CONTEXT:
            {json.dumps(context, indent=2)}
            
            BASE STRATEGY:
            {json.dumps(base_strategy, indent=2)}
            
            Please provide competitive analysis including:
            1. Competitor identification and analysis
            2. Market gap identification
            3. Differentiation opportunities
            4. Competitive positioning
            5. Strategic recommendations
            
            Format as structured JSON with detailed analysis and recommendations.
            """
            
            schema = {
                "type": "object",
                "properties": {
                    "competitors": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string"},
                                "strengths": {"type": "array", "items": {"type": "string"}},
                                "weaknesses": {"type": "array", "items": {"type": "string"}},
                                "content_strategy": {"type": "string"},
                                "market_position": {"type": "string"}
                            }
                        }
                    },
                    "market_gaps": {"type": "array", "items": {"type": "string"}},
                    "opportunities": {"type": "array", "items": {"type": "string"}},
                    "recommendations": {"type": "array", "items": {"type": "string"}}
                }
            }
            
            response = await ai_manager.execute_structured_json_call(
                AIServiceType.MARKET_POSITION_ANALYSIS, 
                prompt, 
                schema,
                user_id=str(user_id) if user_id else None
            )
            
            if not response or not response.get("data"):
                raise RuntimeError("AI service returned empty competitive analysis")
            
            logger.info("✅ Competitive analysis generated successfully")
            
            # Log the raw AI response for debugging
            logger.info(f"🔍 Raw AI response for competitive analysis: {json.dumps(response.get('data', {}), indent=2)}")
            
            # Transform AI response to frontend format
            transformed_response = self._transform_ai_response_to_frontend_format(response.get("data", {}), "competitive_analysis")
            
            # Log the transformed response for debugging
            logger.info(f"🔄 Transformed competitive analysis: {json.dumps(transformed_response, indent=2)}")
            
            return transformed_response
            
        except Exception as e:
            logger.warning(f"⚠️ AI service overload or error during competitive analysis: {str(e)}")
            logger.info("🔄 Continuing strategy generation without competitive analysis...")
            
            # Return empty competitive analysis to allow strategy generation to continue
            return {
                "competitors": [],
                "market_gaps": [],
                "opportunities": [],
                "recommendations": [],
                "ai_generation_failed": True,
                "failure_reason": str(e)
            }

    async def _generate_content_calendar(self, base_strategy: Dict[str, Any], context: Dict[str, Any], user_id: Optional[int] = None, ai_manager: Optional[Any] = None) -> Dict[str, Any]:
        """Generate content calendar using AI."""
        try:
            logger.info("📅 Generating content calendar...")
            
            # Use provided AI manager or create default one
            if ai_manager is None:
                from services.ai_service_manager import AIServiceManager
                ai_manager = AIServiceManager()
            
            prompt = f"""
            Generate comprehensive content calendar for content strategy based on the following context:
            
            CONTEXT:
            {json.dumps(context, indent=2)}
            
            BASE STRATEGY:
            {json.dumps(base_strategy, indent=2)}
            
            Please provide content calendar including:
            1. Content pieces with titles and descriptions
            2. Publishing schedule and timing
            3. Content types and formats
            4. Platform distribution strategy
            5. Content themes and pillars
            
            Format as structured JSON with detailed content schedule.
            """
            
            schema = {
                "type": "object",
                "properties": {
                    "content_pieces": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "title": {"type": "string"},
                                "description": {"type": "string"},
                                "content_type": {"type": "string"},
                                "platform": {"type": "string"},
                                "publishing_date": {"type": "string"},
                                "theme": {"type": "string"},
                                "priority": {"type": "string"}
                            }
                        }
                    },
                    "themes": {"type": "array", "items": {"type": "string"}},
                    "schedule": {
                        "type": "object",
                        "properties": {
                            "publishing_frequency": {"type": "string"},
                            "optimal_times": {"type": "array", "items": {"type": "string"}},
                            "content_mix": {
                                "type": "object",
                                "properties": {
                                    "blog_posts": {"type": "string"},
                                    "social_media": {"type": "string"},
                                    "videos": {"type": "string"},
                                    "infographics": {"type": "string"},
                                    "newsletters": {"type": "string"}
                                }
                            },
                            "seasonal_adjustments": {
                                "type": "object",
                                "properties": {
                                    "holiday_content": {"type": "array", "items": {"type": "string"}},
                                    "seasonal_themes": {"type": "array", "items": {"type": "string"}},
                                    "peak_periods": {"type": "array", "items": {"type": "string"}}
                                }
                            }
                        }
                    },
                    "distribution_strategy": {
                        "type": "object",
                        "properties": {
                            "primary_platforms": {"type": "array", "items": {"type": "string"}},
                            "cross_posting_strategy": {"type": "string"},
                            "platform_specific_content": {
                                "type": "object",
                                "properties": {
                                    "linkedin_content": {"type": "array", "items": {"type": "string"}},
                                    "twitter_content": {"type": "array", "items": {"type": "string"}},
                                    "instagram_content": {"type": "array", "items": {"type": "string"}},
                                    "facebook_content": {"type": "array", "items": {"type": "string"}}
                                }
                            },
                            "engagement_timing": {
                                "type": "object",
                                "properties": {
                                    "best_times": {"type": "array", "items": {"type": "string"}},
                                    "frequency": {"type": "string"},
                                    "timezone_considerations": {"type": "string"}
                                }
                            }
                        }
                    }
                }
            }
            
            response = await ai_manager.execute_structured_json_call(
                AIServiceType.CONTENT_SCHEDULE_GENERATION, 
                prompt, 
                schema,
                user_id=str(user_id) if user_id else None
            )
            
            if not response or not response.get("data"):
                raise RuntimeError("AI service returned empty content calendar")
            
            logger.info("✅ Content calendar generated successfully")
            return response.get("data", {})
            
        except Exception as e:
            logger.error(f"❌ Error generating content calendar: {str(e)}")
            raise RuntimeError(f"Failed to generate content calendar: {str(e)}")

    async def _generate_performance_predictions(self, base_strategy: Dict[str, Any], context: Dict[str, Any], user_id: Optional[int] = None, ai_manager: Optional[Any] = None) -> Dict[str, Any]:
        """Generate performance predictions using AI."""
        try:
            logger.info("📊 Generating performance predictions...")
            
            # Use provided AI manager or create default one
            if ai_manager is None:
                from services.ai_service_manager import AIServiceManager
                ai_manager = AIServiceManager()
            
            prompt = f"""
            Generate comprehensive performance predictions for content strategy based on the following context:
            
            CONTEXT:
            {json.dumps(context, indent=2)}
            
            BASE STRATEGY:
            {json.dumps(base_strategy, indent=2)}
            
            Please provide performance predictions including:
            1. Traffic growth projections
            2. Engagement rate predictions
            3. Conversion rate estimates
            4. ROI projections
            5. Success probability assessment
            
            Format as structured JSON with detailed predictions and confidence levels.
            """
            
            schema = {
                "type": "object",
                "properties": {
                    "traffic_predictions": {
                        "type": "object",
                        "properties": {
                            "monthly_traffic": {"type": "string"},
                            "growth_rate": {"type": "string"},
                            "peak_traffic": {"type": "string"}
                        }
                    },
                    "engagement_predictions": {
                        "type": "object",
                        "properties": {
                            "engagement_rate": {"type": "string"},
                            "time_on_page": {"type": "string"},
                            "bounce_rate": {"type": "string"}
                        }
                    },
                    "conversion_predictions": {
                        "type": "object",
                        "properties": {
                            "conversion_rate": {"type": "string"},
                            "lead_generation": {"type": "string"},
                            "sales_impact": {"type": "string"}
                        }
                    },
                    "roi_predictions": {
                        "type": "object",
                        "properties": {
                            "estimated_roi": {"type": "string"},
                            "cost_benefit": {"type": "string"},
                            "payback_period": {"type": "string"}
                        }
                    }
                }
            }
            
            response = await ai_manager.execute_structured_json_call(
                AIServiceType.PERFORMANCE_PREDICTION, 
                prompt, 
                schema,
                user_id=str(user_id) if user_id else None
            )
            
            if not response or not response.get("data"):
                raise RuntimeError("AI service returned empty performance predictions")
            
            logger.info("✅ Performance predictions generated successfully")
            
            # Transform AI response to frontend format
            transformed_response = self._transform_ai_response_to_frontend_format(response.get("data", {}), "performance_predictions")
            return transformed_response
            
        except Exception as e:
            logger.warning(f"⚠️ AI service overload or error during performance predictions: {str(e)}")
            logger.info("🔄 Continuing strategy generation without performance predictions...")
            
            # Return empty performance predictions to allow strategy generation to continue
            return {
                "traffic_predictions": {},
                "engagement_predictions": {},
                "conversion_predictions": {},
                "roi_predictions": {},
                "ai_generation_failed": True,
                "failure_reason": str(e)
            }

    async def _generate_implementation_roadmap(self, base_strategy: Dict[str, Any], context: Dict[str, Any], user_id: Optional[int] = None, ai_manager: Optional[Any] = None) -> Dict[str, Any]:
        """Generate implementation roadmap using AI."""
        try:
            logger.info("🗺️ Generating implementation roadmap...")
            
            # Use provided AI manager or create default one
            if ai_manager is None:
                from services.ai_service_manager import AIServiceManager
                ai_manager = AIServiceManager()
            
            prompt = f"""
            Generate comprehensive implementation roadmap for content strategy based on the following context:
            
            CONTEXT:
            {json.dumps(context, indent=2)}
            
            BASE STRATEGY:
            {json.dumps(base_strategy, indent=2)}
            
            Please provide implementation roadmap including:
            1. Phase-by-phase breakdown
            2. Timeline with milestones
            3. Resource allocation
            4. Success metrics
            5. Risk mitigation strategies
            
            Format as structured JSON with detailed implementation plan.
            """
            
            schema = {
                "type": "object",
                "properties": {
                    "phases": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "phase": {"type": "string"},
                                "duration": {"type": "string"},
                                "tasks": {"type": "array", "items": {"type": "string"}},
                                "milestones": {"type": "array", "items": {"type": "string"}},
                                "resources": {"type": "array", "items": {"type": "string"}}
                            }
                        }
                    },
                    "timeline": {
                        "type": "object",
                        "properties": {
                            "start_date": {"type": "string"},
                            "end_date": {"type": "string"},
                            "key_milestones": {"type": "array", "items": {"type": "string"}},
                            "critical_path": {"type": "array", "items": {"type": "string"}}
                        }
                    },
                    "resource_allocation": {
                        "type": "object",
                        "properties": {
                            "team_requirements": {"type": "array", "items": {"type": "string"}},
                            "budget_allocation": {
                                "type": "object",
                                "properties": {
                                    "total_budget": {"type": "string"},
                                    "content_creation": {"type": "string"},
                                    "technology_tools": {"type": "string"},
                                    "marketing_promotion": {"type": "string"},
                                    "external_resources": {"type": "string"}
                                }
                            },
                            "technology_needs": {"type": "array", "items": {"type": "string"}},
                            "external_resources": {"type": "array", "items": {"type": "string"}}
                        }
                    },
                    "success_metrics": {"type": "array", "items": {"type": "string"}},
                    "total_duration": {"type": "string"}
                }
            }
            
            response = await ai_manager.execute_structured_json_call(
                AIServiceType.STRATEGIC_INTELLIGENCE, 
                prompt, 
                schema,
                user_id=str(user_id) if user_id else None
            )
            
            if not response or not response.get("data"):
                raise RuntimeError("AI service returned empty implementation roadmap")
            
            logger.info("✅ Implementation roadmap generated successfully")
            logger.info(f"🔍 Raw AI response for implementation roadmap: {json.dumps(response.get('data', {}), indent=2)}")
            
            # Transform AI response to frontend format
            transformed_response = self._transform_ai_response_to_frontend_format(response.get("data", {}), "implementation_roadmap")
            logger.info(f"🔍 Transformed implementation roadmap: {json.dumps(transformed_response, indent=2)}")
            return transformed_response
            
        except Exception as e:
            logger.warning(f"⚠️ AI service overload or error during implementation roadmap: {str(e)}")
            logger.info("🔄 Continuing strategy generation without implementation roadmap...")
            
            # Return empty implementation roadmap to allow strategy generation to continue
            return {
                "phases": [],
                "timeline": {},
                "resource_allocation": {},
                "success_metrics": [],
                "total_duration": "TBD",
                "ai_generation_failed": True,
                "failure_reason": str(e)
            }

    async def _generate_risk_assessment(self, base_strategy: Dict[str, Any], context: Dict[str, Any], user_id: Optional[int] = None, ai_manager: Optional[Any] = None) -> Dict[str, Any]:
        """Generate risk assessment using AI."""
        try:
            logger.info("⚠️ Generating risk assessment...")
            
            # Use provided AI manager or create default one
            if ai_manager is None:
                from services.ai_service_manager import AIServiceManager
                ai_manager = AIServiceManager()
            
            prompt = f"""
            Generate comprehensive risk assessment for content strategy based on the following context:
            
            CONTEXT:
            {json.dumps(context, indent=2)}
            
            BASE STRATEGY:
            {json.dumps(base_strategy, indent=2)}
            
            Please provide risk assessment including:
            1. Risk identification and analysis with detailed risk descriptions
            2. Probability and impact assessment for each risk
            3. Specific mitigation strategies for each risk
            4. Contingency planning for high-impact risks
            5. Risk monitoring framework with key indicators
            6. Categorize risks into: technical_risks, market_risks, operational_risks, financial_risks
            
            IMPORTANT: For risk_categories, categorize each risk into the appropriate category:
            - technical_risks: Technology, platform, tool, or technical implementation risks
            - market_risks: Market changes, competition, audience shifts, industry trends
            - operational_risks: Process, resource, team, or execution risks
            - financial_risks: Budget, ROI, cost, or financial performance risks
            
            Format as structured JSON with detailed risk analysis and mitigation plans.
            """
            
            schema = {
                "type": "object",
                "properties": {
                    "risks": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "risk": {"type": "string"},
                                "probability": {"type": "string"},
                                "impact": {"type": "string"},
                                "mitigation": {"type": "string"},
                                "contingency": {"type": "string"}
                            }
                        }
                    },
                    "overall_risk_level": {"type": "string"},
                    "risk_categories": {
                        "type": "object",
                        "properties": {
                            "technical_risks": {
                                "type": "array", 
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "risk": {"type": "string"},
                                        "probability": {"type": "string"},
                                        "impact": {"type": "string"},
                                        "mitigation": {"type": "string"}
                                    }
                                }
                            },
                            "market_risks": {
                                "type": "array", 
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "risk": {"type": "string"},
                                        "probability": {"type": "string"},
                                        "impact": {"type": "string"},
                                        "mitigation": {"type": "string"}
                                    }
                                }
                            },
                            "operational_risks": {
                                "type": "array", 
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "risk": {"type": "string"},
                                        "probability": {"type": "string"},
                                        "impact": {"type": "string"},
                                        "mitigation": {"type": "string"}
                                    }
                                }
                            },
                            "financial_risks": {
                                "type": "array", 
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "risk": {"type": "string"},
                                        "probability": {"type": "string"},
                                        "impact": {"type": "string"},
                                        "mitigation": {"type": "string"}
                                    }
                                }
                            }
                        }
                    },
                    "mitigation_strategies": {"type": "array", "items": {"type": "string"}},
                    "monitoring_framework": {
                        "type": "object",
                        "properties": {
                            "key_indicators": {"type": "array", "items": {"type": "string"}},
                            "monitoring_frequency": {"type": "string"},
                            "escalation_procedures": {"type": "array", "items": {"type": "string"}},
                            "review_schedule": {"type": "string"}
                        }
                    }
                }
            }
            
            response = await ai_manager.execute_structured_json_call(
                AIServiceType.STRATEGIC_INTELLIGENCE, 
                prompt, 
                schema,
                user_id=str(user_id) if user_id else None
            )
            
            if not response or not response.get("data"):
                raise RuntimeError("AI service returned empty risk assessment")
            
            logger.info("✅ Risk assessment generated successfully")
            
            # Transform AI response to frontend format
            transformed_response = self._transform_ai_response_to_frontend_format(response.get("data", {}), "risk_assessment")
            return transformed_response
            
        except Exception as e:
            logger.warning(f"⚠️ AI service overload or error during risk assessment: {str(e)}")
            logger.info("🔄 Continuing strategy generation without risk assessment...")
            
            # Return empty risk assessment to allow strategy generation to continue
            return {
                "risks": [],
                "overall_risk_level": "Medium",
                "risk_categories": {
                    "technical_risks": [],
                    "market_risks": [],
                    "operational_risks": [],
                    "financial_risks": []
                },
                "mitigation_strategies": [],
                "monitoring_framework": {
                    "key_indicators": [],
                    "monitoring_frequency": "Monthly",
                    "escalation_procedures": [],
                    "review_schedule": "Quarterly"
                },
                "ai_generation_failed": True,
                "failure_reason": str(e)
            }

    def _build_strategic_insights_prompt(self, base_strategy: Dict[str, Any], context: Dict[str, Any]) -> str:
        """Build prompt for strategic insights generation."""
        return f"""
        As an expert content strategy consultant with 15+ years of experience, analyze this content strategy and provide strategic insights:

        STRATEGY CONTEXT:
        {json.dumps(base_strategy, indent=2)}

        USER CONTEXT:
        {json.dumps(context, indent=2)}

        Provide comprehensive strategic insights covering:
        1. Key insights about the strategy's strengths and opportunities
        2. Strategic recommendations with priority levels
        3. Identified opportunity areas for growth
        4. Competitive advantages to leverage

        Focus on actionable, data-driven insights that will drive content strategy success.
        """

    def _build_competitive_analysis_prompt(self, base_strategy: Dict[str, Any], context: Dict[str, Any]) -> str:
        """Build prompt for competitive analysis generation."""
        return f"""
        As a competitive intelligence expert, analyze the competitive landscape for this content strategy:

        STRATEGY CONTEXT:
        {json.dumps(base_strategy, indent=2)}

        USER CONTEXT:
        {json.dumps(context, indent=2)}

        Provide comprehensive competitive analysis covering:
        1. Competitive landscape analysis with key players
        2. Positioning strategy and differentiation factors
        3. Market gaps and opportunities
        4. Competitive advantages and unique value propositions

        Focus on actionable competitive intelligence that will inform strategic positioning.
        """

    def _build_content_calendar_prompt(self, base_strategy: Dict[str, Any], context: Dict[str, Any]) -> str:
        """Build prompt for content calendar generation."""
        return f"""
        As a content strategy expert, create a comprehensive content calendar for this strategy:

        STRATEGY CONTEXT:
        {json.dumps(base_strategy, indent=2)}

        USER CONTEXT:
        {json.dumps(context, indent=2)}

        Generate a {self.config.max_content_pieces}-piece content calendar covering {self.config.timeline_months} months including:
        1. Diverse content pieces (blog posts, social media, videos, etc.)
        2. Publishing schedule with optimal timing
        3. Content mix distribution
        4. Topic clusters and content pillars
        5. Target audience alignment

        Ensure content aligns with business objectives and audience preferences.
        """

    def _build_performance_predictions_prompt(self, base_strategy: Dict[str, Any], context: Dict[str, Any]) -> str:
        """Build prompt for performance predictions generation."""
        return f"""
        As a data-driven content strategist, predict performance outcomes for this content strategy:

        STRATEGY CONTEXT:
        {json.dumps(base_strategy, indent=2)}

        USER CONTEXT:
        {json.dumps(context, indent=2)}

        Provide realistic performance predictions covering:
        1. Traffic growth projections (3, 6, 12 months)
        2. Engagement metrics predictions
        3. Conversion and lead generation forecasts
        4. ROI estimates and success probability
        5. Key performance indicators with targets

        Base predictions on industry benchmarks and strategy characteristics.
        """

    def _build_implementation_roadmap_prompt(self, base_strategy: Dict[str, Any], context: Dict[str, Any]) -> str:
        """Build prompt for implementation roadmap generation."""
        return f"""
        As a project management expert, create an implementation roadmap for this content strategy:

        STRATEGY CONTEXT:
        {json.dumps(base_strategy, indent=2)}

        USER CONTEXT:
        {json.dumps(context, indent=2)}

        Create a detailed implementation roadmap covering:
        1. Phased implementation approach
        2. Resource requirements and budget allocation
        3. Timeline with milestones and deliverables
        4. Critical path and dependencies
        5. Success metrics and evaluation criteria

        Ensure roadmap is realistic and achievable given available resources.
        """

    def _build_risk_assessment_prompt(self, base_strategy: Dict[str, Any], context: Dict[str, Any]) -> str:
        """Build prompt for risk assessment generation."""
        return f"""
        As a risk management expert, assess potential risks for this content strategy:

        STRATEGY CONTEXT:
        {json.dumps(base_strategy, indent=2)}

        USER CONTEXT:
        {json.dumps(context, indent=2)}

        Provide comprehensive risk assessment covering:
        1. Identified risks with probability and impact
        2. Risk categorization (market, operational, competitive, resource)
        3. Mitigation strategies for each risk
        4. Contingency plans for high-impact scenarios
        5. Overall risk level assessment

        Focus on practical risk mitigation strategies.
        """

    def _transform_ai_response_to_frontend_format(self, ai_response: Dict[str, Any], response_type: str) -> Dict[str, Any]:
        """
        Transform AI response to frontend-expected format to fix empty arrays issue.
        
        Args:
            ai_response: Raw AI response
            response_type: Type of response (strategic_insights, competitive_analysis, etc.)
            
        Returns:
            Transformed response in frontend-expected format
        """
        try:
            if response_type == "strategic_insights":
                return self._transform_strategic_insights(ai_response)
            elif response_type == "competitive_analysis":
                return self._transform_competitive_analysis(ai_response)
            elif response_type == "performance_predictions":
                return self._transform_performance_predictions(ai_response)
            elif response_type == "implementation_roadmap":
                return self._transform_implementation_roadmap(ai_response)
            elif response_type == "risk_assessment":
                return self._transform_risk_assessment(ai_response)
            else:
                return ai_response
        except Exception as e:
            self.logger.error(f"Error transforming {response_type} response: {str(e)}")
            return ai_response

    def _transform_strategic_insights(self, ai_response: Dict[str, Any]) -> Dict[str, Any]:
        """Transform strategic insights to frontend format."""
        transformed = {
            "market_positioning": {
                "positioning_strength": 75,
                "current_position": "Emerging",
                "swot_analysis": {
                    "strengths": [],
                    "opportunities": []
                }
            },
            "content_opportunities": [],
            "growth_potential": {
                "market_size": "Growing",
                "growth_rate": "High",
                "key_drivers": [],
                "competitive_advantages": []
            },
            "swot_summary": {
                "overall_score": 75,
                "primary_strengths": [],
                "key_opportunities": []
            }
        }

        # Extract insights from AI response
        insights = ai_response.get("insights", [])
        if insights:
            # Extract content opportunities
            content_opportunities = []
            key_drivers = []
            competitive_advantages = []
            strengths = []
            opportunities = []

            for insight in insights:
                insight_type = insight.get("type", "").lower()
                insight_text = insight.get("insight", "")
                
                # More flexible matching to capture different types of insights
                if any(keyword in insight_type for keyword in ["opportunity", "content", "market"]) or any(keyword in insight_text.lower() for keyword in ["opportunity", "content", "market"]):
                    if any(keyword in insight_text.lower() for keyword in ["content", "blog", "article", "post", "video", "social"]):
                        content_opportunities.append(insight_text)
                    else:
                        opportunities.append(insight_text)
                elif any(keyword in insight_type for keyword in ["strength", "advantage", "competitive"]) or any(keyword in insight_text.lower() for keyword in ["strength", "advantage", "competitive"]):
                    if any(keyword in insight_text.lower() for keyword in ["competitive", "advantage", "differentiation"]):
                        competitive_advantages.append(insight_text)
                    else:
                        strengths.append(insight_text)
                elif any(keyword in insight_type for keyword in ["driver", "growth", "trend"]) or any(keyword in insight_text.lower() for keyword in ["driver", "growth", "trend"]):
                    key_drivers.append(insight_text)
                else:
                    # Default categorization based on content
                    if any(keyword in insight_text.lower() for keyword in ["opportunity", "potential", "growth"]):
                        opportunities.append(insight_text)
                    elif any(keyword in insight_text.lower() for keyword in ["strength", "advantage", "strong"]):
                        strengths.append(insight_text)
                    elif any(keyword in insight_text.lower() for keyword in ["driver", "trend", "factor"]):
                        key_drivers.append(insight_text)

            # Ensure we have some data even if categorization didn't work
            if not content_opportunities and insights:
                content_opportunities = [insight.get("insight", "") for insight in insights[:3]]
            if not opportunities and insights:
                opportunities = [insight.get("insight", "") for insight in insights[3:6]]
            if not strengths and insights:
                strengths = [insight.get("insight", "") for insight in insights[6:9]]
            if not key_drivers and insights:
                key_drivers = [insight.get("insight", "") for insight in insights[9:12]]

            # Update transformed data
            transformed["content_opportunities"] = content_opportunities[:3]  # Limit to 3
            transformed["growth_potential"]["key_drivers"] = key_drivers[:3]
            transformed["growth_potential"]["competitive_advantages"] = competitive_advantages[:3]
            transformed["market_positioning"]["swot_analysis"]["strengths"] = strengths[:3]
            transformed["market_positioning"]["swot_analysis"]["opportunities"] = opportunities[:3]
            transformed["swot_summary"]["primary_strengths"] = strengths[:3]
            transformed["swot_summary"]["key_opportunities"] = opportunities[:3]

        return transformed

    def _transform_competitive_analysis(self, ai_response: Dict[str, Any]) -> Dict[str, Any]:
        """Transform competitive analysis to frontend format."""
        transformed = {
            "competitors": [],
            "market_gaps": [],
            "opportunities": [],
            "recommendations": [],
            "competitive_advantages": {
                "primary": [],
                "sustainable": [],
                "development_areas": []
            },
            "swot_competitive_insights": {
                "leverage_strengths": [],
                "address_weaknesses": [],
                "capitalize_opportunities": [],
                "mitigate_threats": []
            }
        }

        # Extract competitive insights from AI response - handle both insights array and direct fields
        insights = ai_response.get("insights", [])
        competitors = ai_response.get("competitors", [])
        market_gaps = ai_response.get("market_gaps", [])
        opportunities = ai_response.get("opportunities", [])
        recommendations = ai_response.get("recommendations", [])

        # Process insights array if available
        if insights:
            for insight in insights:
                insight_type = insight.get("type", "").lower()
                insight_text = insight.get("insight", "")
                
                if any(keyword in insight_type for keyword in ["gap", "market"]) or any(keyword in insight_text.lower() for keyword in ["gap", "market", "missing"]):
                    market_gaps.append(insight_text)
                elif any(keyword in insight_type for keyword in ["opportunity", "potential"]) or any(keyword in insight_text.lower() for keyword in ["opportunity", "potential", "growth"]):
                    opportunities.append(insight_text)
                elif any(keyword in insight_type for keyword in ["recommendation", "strategy", "action"]) or any(keyword in insight_text.lower() for keyword in ["recommendation", "strategy", "action", "should"]):
                    recommendations.append(insight_text)

        # Ensure we have some data even if categorization didn't work
        if not market_gaps and insights:
            market_gaps = [insight.get("insight", "") for insight in insights[:3]]
        if not opportunities and insights:
            opportunities = [insight.get("insight", "") for insight in insights[3:6]]
        if not recommendations and insights:
            recommendations = [insight.get("insight", "") for insight in insights[6:9]]

        # Update transformed data
        transformed["competitors"] = competitors[:3] if competitors else []
        transformed["market_gaps"] = market_gaps[:3]
        transformed["opportunities"] = opportunities[:3]
        transformed["recommendations"] = recommendations[:3]
        transformed["competitive_advantages"]["primary"] = opportunities[:3]  # Use opportunities as primary advantages
        transformed["competitive_advantages"]["sustainable"] = recommendations[:3]  # Use recommendations as sustainable advantages
        transformed["competitive_advantages"]["development_areas"] = market_gaps[:3]  # Use market gaps as development areas
        transformed["swot_competitive_insights"]["leverage_strengths"] = opportunities[:2]
        transformed["swot_competitive_insights"]["capitalize_opportunities"] = opportunities[:2]
        transformed["swot_competitive_insights"]["address_weaknesses"] = market_gaps[:2]
        transformed["swot_competitive_insights"]["mitigate_threats"] = recommendations[:2]

        return transformed

    def _transform_performance_predictions(self, ai_response: Dict[str, Any]) -> Dict[str, Any]:
        """Transform performance predictions to frontend format."""
        transformed = {
            "estimated_roi": "20-30%",
            "traffic_growth": {
                "month_3": "25%",
                "month_6": "50%",
                "month_12": "100%"
            },
            "engagement_metrics": {
                "time_on_page": "3-5 minutes",
                "bounce_rate": "35-45%",
                "social_shares": "15-25 per post"
            },
            "conversion_predictions": {
                "lead_generation": "5-8%",
                "email_signups": "3-5%",
                "content_downloads": "8-12%"
            },
            "success_probability": "85%"
        }

        # Extract performance data from AI response
        predictions = ai_response.get("predictions", {})
        if predictions:
            if "roi" in predictions:
                transformed["estimated_roi"] = predictions["roi"]
            if "success_probability" in predictions:
                transformed["success_probability"] = predictions["success_probability"]

        return transformed

    def _transform_implementation_roadmap(self, ai_response: Dict[str, Any]) -> Dict[str, Any]:
        """Transform implementation roadmap to frontend format."""
        self.logger.info(f"🔍 Transforming implementation roadmap. Input: {json.dumps(ai_response, indent=2)}")
        
        transformed = {
            "phases": [],
            "timeline": "12 months",
            "resource_requirements": [],
            "milestones": [],
            "critical_path": [],
            "success_metrics": []
        }

        # Extract roadmap data from AI response - data is at top level, not nested under "roadmap"
        if ai_response:
            # Extract phases
            phases = ai_response.get("phases", [])
            if phases:
                transformed["phases"] = phases[:4]  # Limit to 4 phases
            
            # Extract timeline
            timeline = ai_response.get("timeline", {})
            if timeline:
                if isinstance(timeline, dict):
                    # If timeline is an object, extract the duration or use total_duration
                    transformed["timeline"] = timeline.get("total_duration", "12 months")
                    # Extract milestones from timeline object
                    milestones = timeline.get("key_milestones", [])
                    if milestones:
                        transformed["milestones"] = milestones[:6]
                    # Extract critical path from timeline object
                    critical_path = timeline.get("critical_path", [])
                    if critical_path:
                        transformed["critical_path"] = critical_path[:5]
                else:
                    # If timeline is a string, use it directly
                    transformed["timeline"] = str(timeline)
            
            # Extract total_duration if available
            total_duration = ai_response.get("total_duration")
            if total_duration:
                transformed["timeline"] = str(total_duration)
            
            # Extract resource allocation
            resource_allocation = ai_response.get("resource_allocation", {})
            if resource_allocation:
                team_requirements = resource_allocation.get("team_requirements", [])
                if team_requirements:
                    transformed["resource_requirements"] = team_requirements[:5]
            
            # Extract success metrics
            success_metrics = ai_response.get("success_metrics", [])
            if success_metrics:
                transformed["success_metrics"] = success_metrics[:5]

        self.logger.info(f"🔍 Final transformed implementation roadmap: {json.dumps(transformed, indent=2)}")
        return transformed

    def _transform_risk_assessment(self, ai_response: Dict[str, Any]) -> Dict[str, Any]:
        """Transform risk assessment to frontend format."""
        self.logger.info(f"🔍 Transforming risk assessment. Input: {json.dumps(ai_response, indent=2)}")
        
        transformed = {
            "risks": [],
            "overall_risk_level": "Medium",
            "risk_categories": {
                "technical_risks": [],
                "market_risks": [],
                "operational_risks": [],
                "financial_risks": []
            },
            "mitigation_strategies": [],
            "monitoring_framework": {
                "key_indicators": [],
                "monitoring_frequency": "Weekly",
                "escalation_procedures": [],
                "review_schedule": "Monthly"
            }
        }

        # Extract overall risk level
        if ai_response.get("overall_risk_level"):
            transformed["overall_risk_level"] = ai_response["overall_risk_level"]

        # Extract risk data from AI response
        risks = ai_response.get("risks", [])
        if risks:
            transformed["risks"] = risks[:5]  # Limit to 5 risks

        # Extract risk categories from AI response
        risk_categories = ai_response.get("risk_categories", {})
        if risk_categories:
            transformed["risk_categories"] = {
                "technical_risks": risk_categories.get("technical_risks", []),
                "market_risks": risk_categories.get("market_risks", []),
                "operational_risks": risk_categories.get("operational_risks", []),
                "financial_risks": risk_categories.get("financial_risks", [])
            }

        # Extract mitigation strategies from AI response
        mitigation_strategies = ai_response.get("mitigation_strategies", [])
        if mitigation_strategies:
            transformed["mitigation_strategies"] = mitigation_strategies
        else:
            # Fallback: extract mitigation from individual risks
            if risks:
                transformed["mitigation_strategies"] = [risk.get("mitigation", "") for risk in risks[:3] if risk.get("mitigation")]

        # Extract monitoring framework from AI response
        monitoring_framework = ai_response.get("monitoring_framework", {})
        if monitoring_framework:
            transformed["monitoring_framework"] = {
                "key_indicators": monitoring_framework.get("key_indicators", []),
                "monitoring_frequency": monitoring_framework.get("monitoring_frequency", "Weekly"),
                "escalation_procedures": monitoring_framework.get("escalation_procedures", []),
                "review_schedule": monitoring_framework.get("review_schedule", "Monthly")
            }

        self.logger.info(f"🔍 Final transformed risk assessment: {json.dumps(transformed, indent=2)}")
        return transformed 