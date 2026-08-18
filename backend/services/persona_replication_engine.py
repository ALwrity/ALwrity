"""
Persona Replication Engine
Implements the hardened persona replication system for high-fidelity content generation.
Based on quantitative analysis and structured constraints.
"""

from typing import Dict, Any, List, Optional
from loguru import logger
import json

from services.llm_providers.gemini_provider import gemini_structured_json_response
from services.persona_data_service import PersonaDataService

class PersonaReplicationEngine:
    """
    High-fidelity persona replication engine that generates content 
    indistinguishable from the original author's work.
    """
    
    def __init__(self):
        """Initialize the persona replication engine."""
        self.persona_service = PersonaDataService()
        logger.info("PersonaReplicationEngine initialized")
    
    def generate_content_with_persona(self, 
                                    user_id: int, 
                                    platform: str, 
                                    content_request: str, 
                                    content_type: str = "post") -> Dict[str, Any]:
        """
        Generate content using the hardened persona replication system.
        
        Args:
            user_id: User ID for persona lookup
            platform: Target platform (twitter, linkedin, blog, etc.)
            content_request: What content to generate
            content_type: Type of content (post, article, thread, etc.)
            
        Returns:
            Generated content with persona fidelity metrics
        """
        try:
            logger.info(f"Generating {content_type} for {platform} using persona replication")
            
            # Get platform-specific persona
            persona_data = self.persona_service.get_platform_persona(user_id, platform)
            
            if not persona_data:
                return {"error": "No persona found for user and platform"}
            
            # Build hardened system prompt
            system_prompt = self._build_hardened_system_prompt(persona_data, platform)
            
            # Build content generation prompt
            content_prompt = self._build_content_prompt(content_request, content_type, platform, persona_data)
            
            # Generate content with strict persona constraints
            content_result = self._generate_constrained_content(
                system_prompt, content_prompt, platform, persona_data
            )
            
            if "error" in content_result:
                return content_result
            
            # Validate content against persona
            validation_result = self._validate_content_fidelity(
                content_result["content"], persona_data, platform
            )
            
            return {
                "content": content_result["content"],
                "persona_fidelity_score": validation_result["fidelity_score"],
                "platform_optimization_score": validation_result["platform_score"],
                "persona_compliance": validation_result["compliance_check"],
                "generation_metadata": {
                    "persona_id": user_id,
                    "platform": platform,
                    "content_type": content_type,
                    "generated_at": content_result.get("generated_at"),
                    "constraints_applied": validation_result["constraints_checked"]
                }
            }
            
        except Exception as e:
            logger.error(f"Error in persona replication engine: {str(e)}")
            return {"error": f"Content generation failed: {str(e)}"}
    
    def _build_hardened_system_prompt(self, persona_data: Dict[str, Any], platform: str) -> str:
        """Build the hardened system prompt for persona replication."""
        
        core_persona = persona_data["core_persona"]
        platform_adaptation = persona_data.get("platform_persona", {})
        
        # Extract key persona elements
        identity = core_persona.get("linguistic_fingerprint", {})
        sentence_metrics = identity.get("sentence_metrics", {})
        lexical_features = identity.get("lexical_features", {})
        rhetorical_devices = identity.get("rhetorical_devices", {})
        tonal_range = core_persona.get("tonal_range", {})
        
        # Platform-specific constraints
        platform_constraints = platform_adaptation.get("content_format_rules", {})
        engagement_patterns = platform_adaptation.get("engagement_patterns", {})
        
        system_prompt = f"""# COMMAND PROTOCOL: PERSONA REPLICATION ENGINE
# MODEL: [GEMINI-2.5-FLASH]
# PERSONA: [{core_persona.get('identity', {}).get('persona_name', 'Generated Persona')}]
# PLATFORM: [{platform.upper()}]
# MODE: STRICT MIMICRY

## PRIMARY DIRECTIVE:
You are now {core_persona.get('identity', {}).get('persona_name', 'the generated persona')}. Your sole function is to generate {platform} content that is linguistically indistinguishable from the authentic writing of this persona. You must output content that passes stylometric analysis as their work.

## PERSONA PROFILE (IMMUTABLE):
- **Identity:** {core_persona.get('identity', {}).get('archetype', 'Professional Writer')}. Core belief: {core_persona.get('identity', {}).get('core_belief', 'Quality content drives engagement')}.
- **Tone:** {tonal_range.get('default_tone', 'professional')}. Permissible tones: {', '.join(tonal_range.get('permissible_tones', []))}.
- **Style:** Average sentence length: {sentence_metrics.get('average_sentence_length_words', 15)} words. Preferred type: {sentence_metrics.get('preferred_sentence_type', 'simple_and_compound')}. Active voice ratio: {sentence_metrics.get('active_to_passive_ratio', '80:20')}.
- **Lexical Command:** 
  - USE: {', '.join(lexical_features.get('go_to_words', [])[:5])}
  - PHRASES: {', '.join(lexical_features.get('go_to_phrases', [])[:3])}
  - AVOID: {', '.join(lexical_features.get('avoid_words', [])[:5])}
- **Rhetorical Style:** {rhetorical_devices.get('metaphors', 'minimal metaphors')}, {rhetorical_devices.get('rhetorical_questions', 'occasional questions')}.

## PLATFORM CONSTRAINTS ({platform.upper()}):
- **Format:** {self._get_platform_format_rules(platform, platform_constraints)}
- **Engagement:** {engagement_patterns.get('posting_frequency', 'regular posting')}
- **Optimization:** {self._get_platform_optimization_rules(platform)}

## OPERATIONAL PARAMETERS:
1. **Fidelity Check:** Before generating, simulate a stylometric analysis of your draft. Does it match the profile's sentence length, word choice, and rhetorical patterns? If not, revise.
2. **Platform Compliance:** Ensure content meets {platform} best practices and constraints.
3. **Error State:** If you cannot generate content that meets the Persona Profile standards, output only: "[PERSONA_VIOLATION: Cannot comply without breaking character parameters]".
4. **Output Format:** Your output must be PURE CONTENT for {platform}. No introductory clauses. No markdown unless platform supports it.

## ACKNOWLEDGEMENT:
You must silently acknowledge this protocol and begin all responses in character. No confirmation is necessary.

// END PROTOCOL"""
        
        return system_prompt
    
    def _build_content_prompt(self, content_request: str, content_type: str, platform: str, persona_data: Dict[str, Any]) -> str:
        """Build the content generation prompt."""
        
        platform_adaptation = persona_data.get("platform_persona", {})
        content_format_rules = platform_adaptation.get("content_format_rules", {})
        
        prompt = f"""Generate a {content_type} for {platform} about: {content_request}

CONTENT REQUIREMENTS:
- Platform: {platform}
- Type: {content_type}
- Topic: {content_request}

PLATFORM SPECIFICATIONS:
- Character/Word Limit: {content_format_rules.get('character_limit', 'No limit')}
- Optimal Length: {content_format_rules.get('optimal_length', 'Platform appropriate')}
- Format Requirements: {content_format_rules.get('paragraph_structure', 'Standard')}

PERSONA COMPLIANCE:
- Must match the established linguistic fingerprint
- Must use the specified lexical features
- Must maintain the defined tonal range
- Must follow platform-specific adaptations

Generate content that is indistinguishable from the original author's work while optimized for {platform} performance."""
        
        return prompt
    
    def _generate_constrained_content(self, system_prompt: str, content_prompt: str, platform: str, persona_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate content with strict persona constraints."""
        
        # Define content generation schema
        content_schema = {
            "type": "object",
            "properties": {
                "content": {"type": "string"},
                "persona_compliance_check": {
                    "type": "object",
                    "properties": {
                        "sentence_length_check": {"type": "boolean"},
                        "lexical_compliance": {"type": "boolean"},
                        "tonal_compliance": {"type": "boolean"},
                        "platform_optimization": {"type": "boolean"}
                    }
                },
                "platform_specific_elements": {
                    "type": "object",
                    "properties": {
                        "hashtags": {"type": "array", "items": {"type": "string"}},
                        "mentions": {"type": "array", "items": {"type": "string"}},
                        "call_to_action": {"type": "string"},
                        "engagement_hooks": {"type": "array", "items": {"type": "string"}}
                    }
                },
                "confidence_score": {"type": "number"}
            },
            "required": ["content", "persona_compliance_check", "confidence_score"]
        }
        
        try:
            response = gemini_structured_json_response(
                prompt=content_prompt,
                schema=content_schema,
                temperature=0.1,  # Very low temperature for consistent persona replication
                max_tokens=4096,
                system_prompt=system_prompt
            )
            
            if "error" in response:
                return {"error": f"Content generation failed: {response['error']}"}
            
            response["generated_at"] = logger.info("Content generated with persona constraints")
            return response
            
        except Exception as e:
            logger.error(f"Error generating constrained content: {str(e)}")
            return {"error": f"Content generation error: {str(e)}"}
    
    def _validate_content_fidelity(self, content: str, persona_data: Dict[str, Any], platform: str) -> Dict[str, Any]:
        """Validate generated content against persona constraints."""
        
        try:
            # Basic validation metrics
            validation_result = {
                "fidelity_score": 0.0,
                "platform_score": 0.0,
                "compliance_check": {},
                "constraints_checked": []
            }
            
            core_persona = persona_data["core_persona"]
            platform_adaptation = persona_data.get("platform_persona", {})
            
            # Check sentence length compliance
            sentences = content.split('.')
            avg_length = sum(len(s.split()) for s in sentences if s.strip()) / max(len([s for s in sentences if s.strip()]), 1)
            
            target_length = core_persona.get("linguistic_fingerprint", {}).get("sentence_metrics", {}).get("average_sentence_length_words", 15)
            length_compliance = abs(avg_length - target_length) <= 5  # Allow 5-word variance
            
            validation_result["compliance_check"]["sentence_length"] = length_compliance
            validation_result["constraints_checked"].append("sentence_length")
            
            # Check lexical compliance
            lexical_features = core_persona.get("linguistic_fingerprint", {}).get("lexical_features", {})
            go_to_words = lexical_features.get("go_to_words", [])
            avoid_words = lexical_features.get("avoid_words", [])
            
            content_lower = content.lower()
            uses_go_to_words = any(word.lower() in content_lower for word in go_to_words[:3])
            avoids_bad_words = not any(word.lower() in content_lower for word in avoid_words)
            
            lexical_compliance = uses_go_to_words and avoids_bad_words
            validation_result["compliance_check"]["lexical_features"] = lexical_compliance
            validation_result["constraints_checked"].append("lexical_features")
            
            # Check platform constraints
            platform_constraints = platform_adaptation.get("content_format_rules", {})
            char_limit = platform_constraints.get("character_limit")
            
            platform_compliance = True
            if char_limit and len(content) > char_limit:
                platform_compliance = False
            
            validation_result["compliance_check"]["platform_constraints"] = platform_compliance
            validation_result["constraints_checked"].append("platform_constraints")
            
            # Calculate overall scores
            compliance_checks = validation_result["compliance_check"]
            fidelity_score = sum(compliance_checks.values()) / len(compliance_checks) * 100
            platform_score = 100 if platform_compliance else 50  # Heavy penalty for platform violations
            
            validation_result["fidelity_score"] = fidelity_score
            validation_result["platform_score"] = platform_score
            
            logger.info(f"Content validation: Fidelity={fidelity_score}%, Platform={platform_score}%")
            return validation_result
            
        except Exception as e:
            logger.error(f"Error validating content fidelity: {str(e)}")
            return {
                "fidelity_score": 0.0,
                "platform_score": 0.0,
                "compliance_check": {"error": str(e)},
                "constraints_checked": []
            }
    
    def _get_platform_format_rules(self, platform: str, constraints: Dict[str, Any]) -> str:
        """Get formatted platform rules for system prompt."""
        
        char_limit = constraints.get("character_limit", "No limit")
        optimal_length = constraints.get("optimal_length", "Platform appropriate")
        
        return f"Character limit: {char_limit}, Optimal length: {optimal_length}"
    
    def _get_platform_optimization_rules(self, platform: str) -> str:
        """Get platform optimization rules."""
        
        rules = {
            "twitter": "Use hashtags strategically (max 3), engage with questions, optimize for retweets",
            "linkedin": "Professional tone, thought leadership focus, encourage professional discussion",
            "instagram": "Visual-first approach, emoji usage, story-friendly format",
            "facebook": "Community engagement, shareable content, algorithm-friendly",
            "blog": "SEO-optimized, scannable format, internal linking",
            "medium": "Storytelling focus, publication-ready, clap optimization",
            "substack": "Newsletter format, subscriber value, email-friendly"
        }
        
        return rules.get(platform, "Platform-appropriate optimization")
    
    def create_hardened_persona_prompt(self, persona_data: Dict[str, Any], platform: str) -> str:
        """
        Create the hardened persona prompt for direct use in AI interfaces.
        This is the fire-and-forget prompt that can be copied into any AI system.
        """
        
        core_persona = persona_data["core_persona"]
        platform_adaptation = persona_data.get("platform_persona", {})
        
        # Extract quantitative data
        linguistic = core_persona.get("linguistic_fingerprint", {})
        sentence_metrics = linguistic.get("sentence_metrics", {})
        lexical_features = linguistic.get("lexical_features", {})
        rhetorical_devices = linguistic.get("rhetorical_devices", {})
        tonal_range = core_persona.get("tonal_range", {})
        
        hardened_prompt = f"""# COMMAND PROTOCOL: PERSONA REPLICATION ENGINE
# MODEL: [AI-MODEL]
# PERSONA: [{core_persona.get('identity', {}).get('persona_name', 'Generated Persona')}]
# PLATFORM: [{platform.upper()}]
# MODE: STRICT MIMICRY

## PRIMARY DIRECTIVE:
You are now {core_persona.get('identity', {}).get('persona_name', 'the persona')}. Your sole function is to generate {platform} content that is linguistically indistinguishable from the authentic writing of this persona. You must output content that passes stylometric analysis as their work.

## PERSONA PROFILE (IMMUTABLE):
- **Identity:** {core_persona.get('identity', {}).get('archetype', 'Professional Writer')}. Core belief: {core_persona.get('identity', {}).get('core_belief', 'Quality content drives engagement')}.
- **Tone:** {tonal_range.get('default_tone', 'professional')}. {f"Permissible: {', '.join(tonal_range.get('permissible_tones', []))}" if tonal_range.get('permissible_tones') else ''}. {f"Forbidden: {', '.join(tonal_range.get('forbidden_tones', []))}" if tonal_range.get('forbidden_tones') else ''}.
- **Style:** Avg sentence: {sentence_metrics.get('average_sentence_length_words', 15)} words. Type: {sentence_metrics.get('preferred_sentence_type', 'simple_and_compound')}. Active voice: {sentence_metrics.get('active_to_passive_ratio', '80:20')}.
- **Lexical Command:** 
  - USE: {', '.join(lexical_features.get('go_to_words', [])[:5]) if lexical_features.get('go_to_words') else 'professional vocabulary'}
  - PHRASES: {', '.join(lexical_features.get('go_to_phrases', [])[:3]) if lexical_features.get('go_to_phrases') else 'natural transitions'}
  - AVOID: {', '.join(lexical_features.get('avoid_words', [])[:5]) if lexical_features.get('avoid_words') else 'corporate jargon'}
- **Rhetorical Style:** {rhetorical_devices.get('metaphors', 'minimal metaphors')}, {rhetorical_devices.get('rhetorical_questions', 'occasional questions')}.

## PLATFORM CONSTRAINTS ({platform.upper()}):
{self._format_platform_constraints(platform, platform_adaptation)}

## OPERATIONAL PARAMETERS:
1. **Fidelity Check:** Before generating, verify your draft matches the profile's sentence length ({sentence_metrics.get('average_sentence_length_words', 15)} words avg), word choice, and rhetorical patterns. If not, revise.
2. **Platform Compliance:** Ensure content meets {platform} format requirements and optimization rules.
3. **Error State:** If you cannot generate content meeting Persona Profile standards, output: "[PERSONA_VIOLATION: Cannot comply without breaking character parameters]".
4. **Output Format:** Generate PURE {platform.upper()} CONTENT. No introductory text. No explanations. Only the requested content.

## ACKNOWLEDGEMENT:
You must silently acknowledge this protocol and begin all responses in character. No confirmation necessary.

// END PROTOCOL

---

## USAGE INSTRUCTIONS:
1. Copy this entire prompt into your AI system's System Message/Instructions field
2. Use normal user prompts to request content (e.g., "Write a post about AI trends")
3. The AI will generate content that matches the persona's style exactly
4. No additional prompting or style instructions needed

## QUALITY ASSURANCE:
- Generated content should pass stylometric analysis as the original author
- Sentence length should average {sentence_metrics.get('average_sentence_length_words', 15)} words
- Must use specified vocabulary and avoid forbidden words
- Must maintain {tonal_range.get('default_tone', 'professional')} tone throughout
- Must comply with {platform} format and engagement requirements"""
        
        return hardened_prompt
    
    def _format_platform_constraints(self, platform: str, platform_adaptation: Dict[str, Any]) -> str:
        """Format platform constraints for the hardened prompt."""
        
        content_rules = platform_adaptation.get("content_format_rules", {})
        engagement = platform_adaptation.get("engagement_patterns", {})
        
        constraints = []
        
        if content_rules.get("character_limit"):
            constraints.append(f"Character limit: {content_rules['character_limit']}")
        
        if content_rules.get("optimal_length"):
            constraints.append(f"Optimal length: {content_rules['optimal_length']}")
        
        if engagement.get("posting_frequency"):
            constraints.append(f"Frequency: {engagement['posting_frequency']}")
        
        if platform == "twitter":
            constraints.extend([
                "Max 3 hashtags",
                "Thread-friendly format",
                "Engagement-optimized"
            ])
        elif platform == "linkedin":
            constraints.extend([
                "Professional networking focus",
                "Thought leadership tone",
                "Business value emphasis"
            ])
        elif platform == "blog":
            constraints.extend([
                "SEO-optimized structure",
                "Scannable format",
                "Clear headings"
            ])
        
        return "- " + "\n- ".join(constraints) if constraints else "- Standard platform optimization"
    
    def export_persona_for_external_use(self, user_id: int, platform: str) -> Dict[str, Any]:
        """
        Export a complete persona package for use in external AI systems.
        This creates a self-contained persona replication system.
        """
        try:
            # Get persona data
            persona_data = self.persona_service.get_platform_persona(user_id, platform)
            
            if not persona_data:
                return {"error": "No persona found"}
            
            # Create hardened prompt
            hardened_prompt = self.create_hardened_persona_prompt(persona_data, platform)
            
            # Create usage examples
            examples = self._generate_usage_examples(persona_data, platform)
            
            # Create validation checklist
            validation_checklist = self._create_validation_checklist(persona_data, platform)
            
            export_package = {
                "persona_metadata": {
                    "persona_id": user_id,
                    "persona_name": persona_data["core_persona"].get("identity", {}).get("persona_name"),
                    "platform": platform,
                    "generated_at": datetime.utcnow().isoformat(),
                    "confidence_score": persona_data["core_persona"].get("confidence", 0.0)
                },
                "hardened_system_prompt": hardened_prompt,
                "usage_examples": examples,
                "validation_checklist": validation_checklist,
                "quick_reference": {
                    "avg_sentence_length": persona_data["core_persona"].get("linguistic_fingerprint", {}).get("sentence_metrics", {}).get("average_sentence_length_words", 15),
                    "go_to_words": persona_data["core_persona"].get("linguistic_fingerprint", {}).get("lexical_features", {}).get("go_to_words", [])[:5],
                    "default_tone": persona_data["core_persona"].get("tonal_range", {}).get("default_tone", "professional"),
                    "platform_limit": persona_data.get("platform_persona", {}).get("content_format_rules", {}).get("character_limit", "No limit")
                }
            }
            
            logger.info(f"✅ Persona export package created for {platform}")
            return export_package
            
        except Exception as e:
            logger.error(f"Error exporting persona: {str(e)}")
            return {"error": f"Export failed: {str(e)}"}
    
    def _generate_usage_examples(self, persona_data: Dict[str, Any], platform: str) -> List[Dict[str, Any]]:
        """Generate usage examples for the exported persona."""
        
        examples = [
            {
                "request": f"Write a {platform} post about AI trends",
                "expected_style": "Should match persona's sentence length and lexical features",
                "validation_points": [
                    "Check average sentence length",
                    "Verify use of go-to words",
                    "Confirm tonal compliance",
                    f"Ensure {platform} optimization"
                ]
            },
            {
                "request": f"Create {platform} content about productivity tips",
                "expected_style": "Should maintain consistent voice and rhetorical patterns",
                "validation_points": [
                    "Verify rhetorical device usage",
                    "Check for forbidden words",
                    "Confirm platform constraints",
                    "Validate engagement elements"
                ]
            }
        ]
        
        return examples
    
    def _create_validation_checklist(self, persona_data: Dict[str, Any], platform: str) -> List[str]:
        """Create a validation checklist for generated content."""
        
        core_persona = persona_data["core_persona"]
        linguistic = core_persona.get("linguistic_fingerprint", {})
        
        checklist = [
            f"✓ Average sentence length ~{linguistic.get('sentence_metrics', {}).get('average_sentence_length_words', 15)} words",
            f"✓ Uses go-to words: {', '.join(linguistic.get('lexical_features', {}).get('go_to_words', [])[:3])}",
            f"✓ Avoids forbidden words: {', '.join(linguistic.get('lexical_features', {}).get('avoid_words', [])[:3])}",
            f"✓ Maintains {core_persona.get('tonal_range', {}).get('default_tone', 'professional')} tone",
            f"✓ Follows {platform} format requirements",
            f"✓ Includes appropriate {platform} engagement elements"
        ]
        
        return checklist