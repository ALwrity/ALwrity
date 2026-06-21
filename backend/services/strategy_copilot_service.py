from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from loguru import logger
from services.llm_providers.gemini_provider import gemini_text_response, gemini_structured_json_response
from api.content_planning.services.content_strategy.onboarding import OnboardingDataIntegrationService

class StrategyCopilotService:
    """Service for CopilotKit strategy assistance using Gemini."""
    
    def __init__(self, db: Session):
        self.db = db
        self.onboarding_integration_service = OnboardingDataIntegrationService()
        self.user_data_service = UserDataService(db)
    
    async def generate_category_data(
        self, 
        category: str, 
        user_description: str, 
        current_form_data: Dict[str, Any],
        user_id: str
    ) -> Dict[str, Any]:
        """Generate data for a specific category."""
        try:
            # Get user onboarding data
            integrated_data = await self.onboarding_integration_service.process_onboarding_data(user_id, self.db)
            onboarding_data = integrated_data.get('canonical_profile', {})
            
            # Build prompt for category generation
            prompt = self._build_category_generation_prompt(
                category, user_description, current_form_data, onboarding_data
            )
            
            # Generate response using Gemini
            response = gemini_text_response(
                prompt=prompt,
                temperature=0.3,
                top_p=0.9,
                n=1,
                max_tokens=2048,
                system_prompt="You are ALwrity's Strategy Assistant. Generate appropriate values for strategy fields."
            )
            
            # Parse and validate response
            generated_data = self._parse_category_response(response, category)
            
            return generated_data
            
        except Exception as e:
            logger.error(f"Error generating category data: {str(e)}")
            raise
    
    async def validate_field(self, field_id: str, value: Any) -> Dict[str, Any]:
        """Validate a specific strategy field."""
        try:
            # Get field definition
            field_definition = self._get_field_definition(field_id)
            
            # Build validation prompt
            prompt = self._build_validation_prompt(field_definition, value)
            
            # Generate validation response using Gemini
            response = gemini_text_response(
                prompt=prompt,
                temperature=0.2,
                top_p=0.9,
                n=1,
                max_tokens=1024,
                system_prompt="You are ALwrity's Strategy Assistant. Validate field values and provide suggestions."
            )
            
            # Parse validation result
            validation_result = self._parse_validation_response(response)
            
            return validation_result
            
        except Exception as e:
            logger.error(f"Error validating field {field_id}: {str(e)}")
            raise
    
    async def analyze_strategy(self, form_data: Dict[str, Any], user_id: str) -> Dict[str, Any]:
        """Analyze complete strategy for completeness and coherence."""
        try:
            # Get user data for context
            integrated_data = await self.onboarding_integration_service.process_onboarding_data(user_id, self.db)
            onboarding_data = integrated_data.get('canonical_profile', {})
            
            # Build analysis prompt
            prompt = self._build_analysis_prompt(form_data, onboarding_data)
            
            # Generate analysis using Gemini
            response = gemini_text_response(
                prompt=prompt,
                temperature=0.3,
                top_p=0.9,
                n=1,
                max_tokens=2048,
                system_prompt="You are ALwrity's Strategy Assistant. Analyze strategies for completeness and coherence."
            )
            
            # Parse analysis result
            analysis_result = self._parse_analysis_response(response)
            
            return analysis_result
            
        except Exception as e:
            logger.error(f"Error analyzing strategy: {str(e)}")
            raise
    
    async def generate_field_suggestions(
        self, 
        field_id: str, 
        current_form_data: Dict[str, Any],
        user_id: str
    ) -> Dict[str, Any]:
        """Generate suggestions for a specific field."""
        try:
            # Get field definition
            field_definition = self._get_field_definition(field_id)
            
            # Get user data
            integrated_data = await self.onboarding_integration_service.process_onboarding_data(user_id, self.db)
            onboarding_data = integrated_data.get('canonical_profile', {})
            
            # Build suggestions prompt
            prompt = self._build_suggestions_prompt(
                field_definition, current_form_data, onboarding_data
            )
            
            # Generate suggestions using Gemini
            response = gemini_text_response(
                prompt=prompt,
                temperature=0.4,
                top_p=0.9,
                n=1,
                max_tokens=1024,
                system_prompt="You are ALwrity's Strategy Assistant. Generate helpful suggestions for strategy fields."
            )
            
            # Parse suggestions
            suggestions = self._parse_suggestions_response(response)
            
            return suggestions
            
        except Exception as e:
            logger.error(f"Error generating suggestions for {field_id}: {str(e)}")
            raise
    
    def _build_category_generation_prompt(
        self, 
        category: str, 
        user_description: str, 
        current_form_data: Dict[str, Any],
        onboarding_data: Dict[str, Any]
    ) -> str:
        """Build prompt for category data generation."""
        return f"""
        You are ALwrity's Strategy Assistant. Generate data for the {category} category based on the user's description.
        
        User Description: {user_description}
        
        Current Form Data: {current_form_data}
        
        Onboarding Data: {onboarding_data}
        
        Category Fields: {self._get_category_fields(category)}
        
        Generate appropriate values for all fields in the {category} category. Return only valid JSON with field IDs as keys.
        
        Example response format:
        {{
            "field_id": "value",
            "another_field": "value"
        }}
        """
    
    def _build_validation_prompt(self, field_definition: Dict[str, Any], value: Any) -> str:
        """Build prompt for field validation."""
        return f"""
        Validate the following field value:
        
        Field: {field_definition['label']}
        Description: {field_definition['description']}
        Required: {field_definition['required']}
        Type: {field_definition['type']}
        Value: {value}
        
        Return JSON with: {{"isValid": boolean, "suggestion": string, "confidence": number}}
        
        Example response:
        {{
            "isValid": true,
            "suggestion": "This looks good!",
            "confidence": 0.95
        }}
        """
    
    def _build_analysis_prompt(
        self, 
        form_data: Dict[str, Any], 
        onboarding_data: Dict[str, Any]
    ) -> str:
        """Build prompt for strategy analysis."""
        return f"""
        Analyze the following content strategy for completeness, coherence, and alignment:
        
        Form Data: {form_data}
        Onboarding Data: {onboarding_data}
        
        Return JSON with: {{
            "completeness": number,
            "coherence": number,
            "alignment": number,
            "suggestions": [string],
            "missingFields": [string],
            "improvements": [string]
        }}
        
        Example response:
        {{
            "completeness": 85,
            "coherence": 90,
            "alignment": 88,
            "suggestions": ["Consider adding more specific metrics"],
            "missingFields": ["content_budget"],
            "improvements": ["Add timeline details"]
        }}
        """
    
    def _build_suggestions_prompt(
        self,
        field_definition: Dict[str, Any],
        current_form_data: Dict[str, Any],
        onboarding_data: Dict[str, Any]
    ) -> str:
        """Build prompt for field suggestions."""
        return f"""
        Generate suggestions for the following field:
        
        Field: {field_definition['label']}
        Description: {field_definition['description']}
        Required: {field_definition['required']}
        Type: {field_definition['type']}
        
        Current Form Data: {current_form_data}
        Onboarding Data: {onboarding_data}
        
        Return JSON with: {{
            "suggestions": [string],
            "reasoning": string,
            "confidence": number
        }}
        
        Example response:
        {{
            "suggestions": ["Focus on measurable outcomes", "Align with business goals"],
            "reasoning": "Based on your business context, measurable outcomes will be most effective",
            "confidence": 0.92
        }}
        """
    
    def _get_field_definition(self, field_id: str) -> Dict[str, Any]:
        """Get field definition from STRATEGIC_INPUT_FIELDS."""
        # This would be imported from the frontend field definitions
        # For now, return a basic structure
        return {
            "id": field_id,
            "label": field_id.replace("_", " ").title(),
            "description": f"Description for {field_id}",
            "required": True,
            "type": "text"
        }
    
    def _get_category_fields(self, category: str) -> List[str]:
        """Get fields for a specific category."""
        # This would be imported from the frontend field definitions
        category_fields = {
            "business_context": [
                "business_objectives", "target_metrics", "content_budget", "team_size",
                "implementation_timeline", "market_share", "competitive_position", "performance_metrics"
            ],
            "audience_intelligence": [
                "content_preferences", "consumption_patterns", "audience_pain_points",
                "buying_journey", "seasonal_trends", "engagement_metrics"
            ],
            "competitive_intelligence": [
                "top_competitors", "competitor_content_strategies", "market_gaps",
                "industry_trends", "emerging_trends"
            ],
            "content_strategy": [
                "preferred_formats", "content_mix", "content_frequency", "optimal_timing",
                "quality_metrics", "editorial_guidelines", "brand_voice"
            ],
            "performance_analytics": [
                "traffic_sources", "conversion_rates", "content_roi_targets", "ab_testing_capabilities"
            ]
        }
        return category_fields.get(category, [])
    
    def _parse_category_response(self, response: str, category: str) -> Dict[str, Any]:
        """Parse LLM response for category data."""
        try:
            import json
            # Clean up the response to extract JSON
            response = response.strip()
            if response.startswith("```json"):
                response = response[7:]
            if response.endswith("```"):
                response = response[:-3]
            response = response.strip()
            
            parsed_data = json.loads(response)
            
            # Validate that we have actual data
            if not isinstance(parsed_data, dict) or len(parsed_data) == 0:
                raise Exception("Invalid or empty response data")
            
            return parsed_data
        except Exception as e:
            logger.error(f"Error parsing category response: {str(e)}")
            raise Exception(f"Failed to parse category response: {str(e)}")
    
    def _parse_validation_response(self, response: str) -> Dict[str, Any]:
        """Parse LLM response for validation."""
        try:
            import json
            # Clean up the response to extract JSON
            response = response.strip()
            if response.startswith("```json"):
                response = response[7:]
            if response.endswith("```"):
                response = response[:-3]
            response = response.strip()
            
            parsed_data = json.loads(response)
            
            # Validate required fields
            if not isinstance(parsed_data, dict) or 'isValid' not in parsed_data:
                raise Exception("Invalid validation response format")
            
            return parsed_data
        except Exception as e:
            logger.error(f"Error parsing validation response: {str(e)}")
            raise Exception(f"Failed to parse validation response: {str(e)}")
    
    def _parse_analysis_response(self, response: str) -> Dict[str, Any]:
        """Parse LLM response for analysis."""
        try:
            import json
            # Clean up the response to extract JSON
            response = response.strip()
            if response.startswith("```json"):
                response = response[7:]
            if response.endswith("```"):
                response = response[:-3]
            response = response.strip()
            
            parsed_data = json.loads(response)
            
            # Validate required fields
            required_fields = ['completeness', 'coherence', 'alignment']
            if not isinstance(parsed_data, dict) or not all(field in parsed_data for field in required_fields):
                raise Exception("Invalid analysis response format")
            
            return parsed_data
        except Exception as e:
            logger.error(f"Error parsing analysis response: {str(e)}")
            raise Exception(f"Failed to parse analysis response: {str(e)}")
    
    def _parse_suggestions_response(self, response: str) -> Dict[str, Any]:
        """Parse LLM response for suggestions."""
        try:
            import json
            # Clean up the response to extract JSON
            response = response.strip()
            if response.startswith("```json"):
                response = response[7:]
            if response.endswith("```"):
                response = response[:-3]
            response = response.strip()
            
            parsed_data = json.loads(response)
            
            # Validate required fields
            if not isinstance(parsed_data, dict) or 'suggestions' not in parsed_data:
                raise Exception("Invalid suggestions response format")
            
            return parsed_data
        except Exception as e:
            logger.error(f"Error parsing suggestions response: {str(e)}")
            raise Exception(f"Failed to parse suggestions response: {str(e)}")
