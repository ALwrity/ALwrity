"""
Facebook Persona Service
Encapsulates Facebook-specific persona generation logic.
"""

from typing import Dict, Any, Optional
from loguru import logger
from datetime import datetime

from .facebook_persona_schemas import (
    FacebookPersonaSchema,
    FacebookPersonaConstraints,
    FacebookPersonaValidation,
    FacebookPersonaOptimization
)
from .facebook_persona_prompts import FacebookPersonaPrompts
from services.llm_providers.main_text_generation import llm_text_gen


class FacebookPersonaService:
    """Facebook-specific persona generation and optimization service."""
    
    _instance = None
    _initialized = False
    
    def __new__(cls):
        """Implement singleton pattern to prevent multiple initializations."""
        if cls._instance is None:
            cls._instance = super(FacebookPersonaService, cls).__new__(cls)
        return cls._instance
    
    def __init__(self):
        """Initialize the Facebook persona service (only once)."""
        if not self._initialized:
            self.schemas = FacebookPersonaSchema
            self.constraints = FacebookPersonaConstraints()
            self.validation = FacebookPersonaValidation()
            self.optimization = FacebookPersonaOptimization()
            self.prompts = FacebookPersonaPrompts()
            logger.debug("FacebookPersonaService initialized")
            self._initialized = True
    
    def generate_facebook_persona(
        self,
        core_persona: Dict[str, Any],
        onboarding_data: Dict[str, Any],
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generate Facebook-specific persona adaptation using optimized chained prompts.

        Args:
            core_persona: The core persona data
            onboarding_data: User onboarding data
            user_id: Optional explicit Clerk user ID. Used for subscription
                checks / usage tracking. Falls back to looking up
                ``onboarding_data["session_info"]["user_id"]`` so
                direct callers (which embed the user_id in the
                onboarding dict) still work.

        Returns:
            Facebook-optimized persona data
        """
        try:
            logger.info("Generating Facebook-specific persona with optimized prompts")

            # Build focused Facebook prompt (without core persona JSON)
            prompt = self.prompts.build_focused_facebook_prompt(onboarding_data)

            # Create system prompt with core persona
            system_prompt = self.prompts.build_facebook_system_prompt(core_persona)

            # Get Facebook-specific schema
            schema = self._get_enhanced_facebook_schema()

            # Resolve user_id for the LLM gateway's subscription check.
            # Prefer the explicit kwarg (the scheduler passes it that
            # way), fall back to the legacy nested key.
            if not user_id and isinstance(onboarding_data, dict):
                session_info = onboarding_data.get("session_info")
                if isinstance(session_info, dict):
                    user_id = session_info.get("user_id")

            # Generate structured response using the provider-agnostic gateway
            # (handles GPT_PROVIDER routing, subscription/usage checks, fallbacks)
            response = llm_text_gen(
                prompt=prompt,
                json_struct=schema,
                temperature=0.2,
                max_tokens=4096,
                system_prompt=system_prompt,
                user_id=user_id,
                flow_type="facebook_persona_generation"
            )

            if not response or "error" in response:
                logger.error(f"Failed to generate Facebook persona: {response}")
                return {"error": f"Failed to generate Facebook persona: {response}"}

            # Validate the generated persona
            validation_results = self.validate_facebook_persona(response)
            
            # Apply algorithm optimization
            optimized_persona = self.optimize_for_facebook_algorithm(response)
            
            # Add validation results to the persona
            optimized_persona["validation_results"] = validation_results
            
            logger.info(f"✅ Facebook persona generated successfully with {validation_results['quality_score']:.1f}% quality score")
            
            return optimized_persona

        except Exception as e:
            logger.error(f"Error generating Facebook persona: {str(e)}")
            return {"error": f"Failed to generate Facebook persona: {str(e)}"}

    def get_facebook_constraints(self) -> Dict[str, Any]:
        """Get Facebook-specific platform constraints."""
        return self.constraints.get_facebook_constraints()

    def validate_facebook_persona(self, persona_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate Facebook persona data for completeness and quality.
        
        Args:
            persona_data: Facebook persona data to validate
            
        Returns:
            Validation results with scores and recommendations
        """
        try:
            logger.info("Validating Facebook persona data")
            
            # Use the validation class
            validation_results = self.validation.validate_facebook_persona(persona_data)
            
            # Initialize missing fields if they don't exist
            if "content_format_score" not in validation_results:
                validation_results["content_format_score"] = 0.0
            if "audience_targeting_score" not in validation_results:
                validation_results["audience_targeting_score"] = 0.0
            if "community_building_score" not in validation_results:
                validation_results["community_building_score"] = 0.0
            
            # Add Facebook-specific validation
            facebook_opt = persona_data.get("facebook_algorithm_optimization", {})
            if facebook_opt:
                validation_results["facebook_optimization_score"] = 90.0
                validation_results["strengths"].append("Facebook algorithm optimization present")
            else:
                validation_results["quality_issues"].append("Missing Facebook algorithm optimization")
                validation_results["recommendations"].append("Add Facebook-specific algorithm strategies")
            
            # Validate engagement strategies
            engagement_strategies = persona_data.get("facebook_engagement_strategies", {})
            if engagement_strategies:
                validation_results["engagement_strategy_score"] = 85.0
                validation_results["strengths"].append("Facebook engagement strategies defined")
            else:
                validation_results["quality_issues"].append("Missing Facebook engagement strategies")
                validation_results["recommendations"].append("Define Facebook-specific engagement tactics")
            
            # Validate content formats
            content_formats = persona_data.get("facebook_content_formats", {})
            if content_formats:
                validation_results["content_format_score"] = 80.0
                validation_results["strengths"].append("Facebook content formats optimized")
            else:
                validation_results["quality_issues"].append("Missing Facebook content format optimization")
                validation_results["recommendations"].append("Add Facebook-specific content format strategies")
            
            # Validate audience targeting
            audience_targeting = persona_data.get("facebook_audience_targeting", {})
            if audience_targeting:
                validation_results["audience_targeting_score"] = 75.0
                validation_results["strengths"].append("Facebook audience targeting strategies present")
            else:
                validation_results["quality_issues"].append("Missing Facebook audience targeting")
                validation_results["recommendations"].append("Add Facebook-specific audience targeting strategies")
            
            # Validate community building
            community_building = persona_data.get("facebook_community_building", {})
            if community_building:
                validation_results["community_building_score"] = 85.0
                validation_results["strengths"].append("Facebook community building strategies defined")
            else:
                validation_results["quality_issues"].append("Missing Facebook community building strategies")
                validation_results["recommendations"].append("Add Facebook-specific community building tactics")
            
            # Recalculate overall quality score
            validation_results["quality_score"] = (
                validation_results["completeness_score"] * 0.2 +
                validation_results["facebook_optimization_score"] * 0.25 +
                validation_results["engagement_strategy_score"] * 0.2 +
                validation_results["content_format_score"] * 0.15 +
                validation_results["audience_targeting_score"] * 0.1 +
                validation_results["community_building_score"] * 0.1
            )
            
            # Add validation timestamp
            validation_results["validation_timestamp"] = datetime.utcnow().isoformat()
            
            logger.info(f"Facebook persona validation completed: Quality Score: {validation_results['quality_score']:.1f}%")
            
            return validation_results

        except Exception as e:
            logger.error(f"Error validating Facebook persona: {str(e)}")
            return {
                "is_valid": False,
                "quality_score": 0.0,
                "error": f"Validation failed: {str(e)}"
            }

    def optimize_for_facebook_algorithm(self, persona_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Optimize Facebook persona data for maximum algorithm performance.
        
        Args:
            persona_data: Facebook persona data to optimize
            
        Returns:
            Optimized Facebook persona data
        """
        try:
            logger.info("Optimizing Facebook persona for algorithm performance")
            
            # Get optimization strategies
            optimization_strategies = self.optimization.get_facebook_optimization_strategies()
            
            # Apply algorithm optimization
            optimized_persona = persona_data.copy()
            
            # Add comprehensive algorithm optimization
            optimized_persona["algorithm_optimization"] = {
                "engagement_optimization": optimization_strategies["algorithm_optimization"]["engagement_optimization"],
                "content_quality_optimization": optimization_strategies["algorithm_optimization"]["content_quality_optimization"],
                "timing_optimization": optimization_strategies["algorithm_optimization"]["timing_optimization"],
                "audience_targeting_optimization": optimization_strategies["algorithm_optimization"]["audience_targeting_optimization"]
            }
            
            # Add engagement strategies
            optimized_persona["engagement_strategies"] = {
                "community_building": optimization_strategies["engagement_strategies"]["community_building"],
                "content_engagement": optimization_strategies["engagement_strategies"]["content_engagement"],
                "conversion_optimization": optimization_strategies["engagement_strategies"]["conversion_optimization"]
            }
            
            # Add content format optimization
            optimized_persona["content_formats"] = optimization_strategies["content_formats"]
            
            # Add audience targeting optimization
            optimized_persona["audience_targeting"] = optimization_strategies["audience_targeting"]
            
            # Add community building optimization
            optimized_persona["community_building"] = optimization_strategies["community_building"]
            
            # Add optimization metadata
            total_strategies = 0
            for category_name, category_data in optimization_strategies.items():
                if isinstance(category_data, dict):
                    for strategy_name, strategies in category_data.items():
                        if isinstance(strategies, list):
                            total_strategies += len(strategies)
                        elif isinstance(strategies, dict):
                            # Handle nested dictionaries
                            for sub_strategy_name, sub_strategies in strategies.items():
                                if isinstance(sub_strategies, list):
                                    total_strategies += len(sub_strategies)
                                else:
                                    total_strategies += 1
                        else:
                            total_strategies += 1
                elif isinstance(category_data, list):
                    total_strategies += len(category_data)
                else:
                    total_strategies += 1
            
            optimized_persona["optimization_metadata"] = {
                "optimization_applied": True,
                "optimization_timestamp": datetime.utcnow().isoformat(),
                "optimization_categories": list(optimization_strategies.keys()),
                "total_optimization_strategies": total_strategies
            }
            
            logger.info("✅ Facebook persona algorithm optimization completed successfully")
            
            return optimized_persona

        except Exception as e:
            logger.error(f"Error optimizing Facebook persona: {str(e)}")
            return persona_data  # Return original data if optimization fails

    def _get_enhanced_facebook_schema(self) -> Dict[str, Any]:
        """Get enhanced Facebook persona schema for Gemini structured response with improved JSON parsing reliability."""
        return {
            "type": "object",
            "description": "Facebook-optimized persona data structure for community engagement and algorithm optimization",
            "properties": {
                "persona_name": {
                    "type": "string",
                    "description": "Name of the Facebook-optimized persona (e.g., 'Community Builder', 'Social Connector')",
                    "minLength": 3,
                    "maxLength": 50
                },
                "archetype": {
                    "type": "string",
                    "description": "Persona archetype for Facebook (e.g., 'The Community Catalyst', 'The Social Storyteller')",
                    "minLength": 5,
                    "maxLength": 50
                },
                "core_belief": {
                    "type": "string",
                    "description": "Core belief driving the Facebook persona (e.g., 'Building authentic connections through shared experiences')",
                    "minLength": 10,
                    "maxLength": 200
                },
                "facebook_algorithm_optimization": {
                    "type": "object",
                    "description": "Facebook algorithm optimization strategies",
                    "properties": {
                        "engagement_optimization": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Strategies for optimizing Facebook engagement (3-8 strategies)",
                            "minItems": 3,
                            "maxItems": 8
                        },
                        "content_quality_optimization": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Strategies for optimizing content quality on Facebook (3-8 strategies)",
                            "minItems": 3,
                            "maxItems": 8
                        },
                        "timing_optimization": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Strategies for optimizing posting timing on Facebook (3-8 strategies)",
                            "minItems": 3,
                            "maxItems": 8
                        },
                        "audience_targeting_optimization": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Strategies for optimizing audience targeting on Facebook (3-8 strategies)",
                            "minItems": 3,
                            "maxItems": 8
                        }
                    }
                },
                "facebook_engagement_strategies": {
                    "type": "object",
                    "description": "Facebook-specific engagement strategies",
                    "properties": {
                        "community_building": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Community building strategies for Facebook"
                        },
                        "content_engagement": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Content engagement strategies for Facebook"
                        },
                        "conversion_optimization": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Conversion optimization strategies for Facebook"
                        }
                    }
                },
                "facebook_content_formats": {
                    "type": "object",
                    "description": "Facebook content format optimizations",
                    "properties": {
                        "text_posts": {
                            "type": "object",
                            "description": "Text post optimization for Facebook",
                            "properties": {
                                "optimal_length": {"type": "string"},
                                "structure_guidelines": {"type": "array", "items": {"type": "string"}},
                                "hook_strategies": {"type": "array", "items": {"type": "string"}}
                            }
                        },
                        "image_posts": {
                            "type": "object",
                            "description": "Image post optimization for Facebook",
                            "properties": {
                                "image_guidelines": {"type": "array", "items": {"type": "string"}},
                                "caption_strategies": {"type": "array", "items": {"type": "string"}}
                            }
                        },
                        "video_posts": {
                            "type": "object",
                            "description": "Video post optimization for Facebook",
                            "properties": {
                                "video_length_guidelines": {"type": "array", "items": {"type": "string"}},
                                "engagement_hooks": {"type": "array", "items": {"type": "string"}}
                            }
                        },
                        "carousel_posts": {
                            "type": "object",
                            "description": "Carousel post optimization for Facebook",
                            "properties": {
                                "slide_structure": {"type": "array", "items": {"type": "string"}},
                                "storytelling_flow": {"type": "array", "items": {"type": "string"}}
                            }
                        }
                    }
                },
                "facebook_audience_targeting": {
                    "type": "object",
                    "description": "Facebook audience targeting strategies",
                    "properties": {
                        "demographic_targeting": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Demographic targeting strategies for Facebook"
                        },
                        "interest_targeting": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Interest targeting strategies for Facebook"
                        },
                        "behavioral_targeting": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Behavioral targeting strategies for Facebook"
                        }
                    }
                },
                "facebook_community_building": {
                    "type": "object",
                    "description": "Facebook community building strategies",
                    "properties": {
                        "group_management": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Facebook Group management strategies"
                        },
                        "event_management": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Facebook Event management strategies"
                        },
                        "live_streaming": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Facebook Live streaming strategies"
                        }
                    }
                },
                "confidence_score": {
                    "type": "number",
                    "description": "Confidence score for the Facebook persona (0-100)",
                    "minimum": 0,
                    "maximum": 100
                }
            },
            "required": [
                "persona_name",
                "archetype",
                "core_belief",
                "facebook_algorithm_optimization",
                "facebook_engagement_strategies",
                "confidence_score"
            ],
            "additionalProperties": False
        }
