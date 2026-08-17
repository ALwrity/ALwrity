"""
Core Persona Service

Handles the core persona generation logic using the provider-agnostic llm_text_gen gateway.
"""

import json
import re
import time

from typing import Dict, Any, List
from loguru import logger
from datetime import datetime

from services.llm_providers.main_text_generation import llm_text_gen
from .data_collector import OnboardingDataCollector
from .prompt_builder import PersonaPromptBuilder
from services.persona.linkedin.linkedin_persona_service import LinkedInPersonaService
from services.persona.facebook.facebook_persona_service import FacebookPersonaService
from services.persona.youtube.youtube_persona_service import YouTubePersonaService
from services.persona.podcast.podcast_persona_service import PodcastPersonaService
from services.persona.enhanced_linguistic_analyzer import get_linguistic_analyzer
from services.persona.platform_registry import PERSONA_PLATFORMS, get_platform_constraints


class CorePersonaService:
    """Core service for generating writing personas using the provider-agnostic LLM gateway."""
    
    _instance = None
    _initialized = False
    
    def __new__(cls):
        """Implement singleton pattern to prevent multiple initializations."""
        if cls._instance is None:
            cls._instance = super(CorePersonaService, cls).__new__(cls)
        return cls._instance
    
    def __init__(self):
        """Initialize the core persona service (only once)."""
        if not self._initialized:
            self.data_collector = OnboardingDataCollector()
            self.prompt_builder = PersonaPromptBuilder()
            self.linkedin_service = LinkedInPersonaService()
            self.facebook_service = FacebookPersonaService()
            self.youtube_service = YouTubePersonaService()
            self.podcast_service = PodcastPersonaService()
            logger.debug("CorePersonaService initialized")
            self._initialized = True
    
    def generate_core_persona(self, onboarding_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate core writing persona using the provider-agnostic LLM gateway."""

        # Phase 2: deterministic linguistic analysis of the brand's own
        # content. We feed real numbers (sentence length, active/passive
        # ratio, readability, vocabulary sophistication, etc.) into the
        # prompt as a new `LINGUISTIC ANALYSIS (deterministic)` section
        # so the LLM can ground its `linguistic_fingerprint` claims in
        # measured reality, not vibes. We swallow any analyzer error and
        # fall back to None so the prompt builder just omits the section.
        linguistic_analysis: Any = None
        try:
            text_samples = self.data_collector.extract_text_samples_from_onboarding_data(onboarding_data)
            if text_samples:
                linguistic_analysis = get_linguistic_analyzer().analyze_writing_style(text_samples)
                if isinstance(linguistic_analysis, dict) and "error" in linguistic_analysis:
                    logger.warning(
                        f"Linguistic analyzer returned error; falling back to soft-mock. "
                        f"Error: {linguistic_analysis.get('error')}"
                    )
                    linguistic_analysis = None
        except Exception as e:
            logger.warning(
                f"Could not run deterministic linguistic analysis: {e}. "
                f"Persona will fall back to soft-mock linguistic_fingerprint."
            )
            linguistic_analysis = None

        # Build analysis prompt (now includes the linguistic_analysis section
        # if we got real numbers)
        prompt = self.prompt_builder.build_persona_analysis_prompt(
            onboarding_data,
            linguistic_analysis=linguistic_analysis,
        )
        
        # Get schema for structured response
        persona_schema = self.prompt_builder.get_persona_schema()
        
        # Extract user_id for tracking
        user_id = onboarding_data.get("session_info", {}).get("user_id")
        
        # System prompt: persona-extractor, not generic analyst.
        # Goal: produce a persona SO specific to this user that no other
        # brand in the world would produce the same output. The data is
        # already extensive (see prompt_builder); the system prompt
        # enforces the bar of specificity.
        system_prompt = (
            "You are a brand voice extractor. Your job is to read the comprehensive "
            "analysis below and produce a brand voice that is SO specific to this user "
            "that no other brand in the world would produce the same output.\n\n"
            "CRITICAL RULES:\n"
            "1. Every claim in the output MUST be grounded in the data provided. If a "
            "section of the data is empty, write `null` for that field — do NOT invent "
            "generic values.\n"
            "2. Do not use generic archetypes like 'expert', 'thought leader', or "
            "'industry professional' unless the data explicitly supports it. "
            "If the data is thin, the archetype should reflect that (\"data-thin — needs "
            "more inputs\") rather than defaulting to a cliché.\n"
            "3. Use specific evidence from the data (e.g., 'uses first-person plural "
            "\"we\" 73% of the time' not 'generally first-person').\n"
            "4. The persona should make it impossible to mistake this brand for any "
            "other brand. A third-party reader should immediately recognize content "
            "written from this persona as belonging to this specific brand.\n"
            "5. The 'evidence' field in the output is REQUIRED and must cite which "
            "data sections led to each major claim.\n"
            "6. The 'what_was_missing' field is REQUIRED and must list which data "
            "sections were empty or thin. The user uses this to know what to plug in."
        )
        
        try:
            # Generate structured response using the provider-agnostic gateway
            # (handles GPT_PROVIDER routing, subscription/usage checks, fallbacks)
            t0 = time.time()
            trace_id = f"alwrity_onboarding_persona_{user_id}"
            response = llm_text_gen(
                prompt=prompt,
                json_struct=persona_schema,
                temperature=0.2,  # Low temperature for consistent analysis
                max_tokens=8192,
                system_prompt=system_prompt,
                user_id=user_id,
                flow_type="core_persona_generation",
                trace_id=trace_id,
            )
            api_took = (time.time() - t0) * 1000

            # Provider shape differs: WaveSpeed/Gemini return a pre-parsed dict,
            # NovaRouteAI/HF return a JSON string (OpenAI-standard). Normalize both.
            parse_t0 = time.time()
            parsed = self._parse_persona_response(response)
            parse_took = (time.time() - parse_t0) * 1000

            validation = self._validate_persona_with_pydantic(parsed)
            logger.warning(
                f"[persona_telemetry] trace={trace_id} "
                f"api_latency_ms={api_took:.0f} parse_ms={parse_took:.0f} "
                f"pydantic_valid={validation['valid']} "
                f"fields_ok={validation['fields_ok']}/{validation['total_fields']} "
                f"parse_source={'direct_dict' if isinstance(response, dict) else 'json_string'}"
            )
            if not validation['valid']:
                logger.warning(
                    f"[persona_telemetry] trace={trace_id} "
                    f"Pydantic errors: {validation.get('errors', '')}"
                )

            if parsed.get("error"):
                logger.error(f"LLM gateway error: {parsed['error']}")
                return {"error": f"AI analysis failed: {parsed['error']}"}
            
            logger.info("✅ Core persona generated successfully")
            return parsed
            
        except Exception as e:
            logger.error(f"Error generating core persona: {str(e)}")
            return {"error": f"Failed to generate core persona: {str(e)}"}
    
    def _parse_persona_response(self, ai_response: Any) -> Dict[str, Any]:
        """Normalize the LLM response to a dict.

        WaveSpeed/Gemini native JSON mode return a pre-parsed dict; NovaRouteAI
        and HF follow the OpenAI standard and return a JSON string. Handle both,
        plus markdown-fenced JSON.
        """
        if isinstance(ai_response, dict):
            return ai_response
        if isinstance(ai_response, str):
            try:
                return json.loads(ai_response)
            except json.JSONDecodeError:
                m = re.search(r'```json\s*(.*?)\s*```', ai_response, re.DOTALL)
                if m:
                    try:
                        return json.loads(m.group(1))
                    except json.JSONDecodeError:
                        pass
        return {"error": f"Unparseable persona response: {str(ai_response)[:200]}"}

    def _validate_persona_with_pydantic(self, persona: Dict[str, Any]) -> Dict[str, Any]:
        """Validate the persona against its required top-level contract.

        Returns dict with: valid, total_fields, fields_ok, errors (field paths
        only, no raw content).
        """
        required_fields = [
            "identity",
            "linguistic_fingerprint",
            "tonal_range",
            "evidence",
            "what_was_missing",
            "confidence",
        ]
        total = len(required_fields)
        try:
            from pydantic import BaseModel, ValidationError

            class CorePersona(BaseModel):
                identity: dict
                linguistic_fingerprint: dict
                tonal_range: dict
                evidence: dict
                what_was_missing: list
                confidence: float

            CorePersona(**persona)
            return {"valid": True, "total_fields": total, "fields_ok": total, "errors": ""}
        except Exception as e:
            error_fields = []
            if hasattr(e, 'errors'):
                for err in e.errors():
                    loc = ".".join(str(x) for x in err.get("loc", []))
                    typ = err.get("type", "unknown")
                    error_fields.append(f"{loc}({typ})")
            return {
                "valid": False,
                "total_fields": total,
                "fields_ok": max(0, total - len(error_fields)),
                "errors": "; ".join(error_fields) if error_fields else str(e)[:200],
            }

    def generate_platform_adaptations(self, core_persona: Dict[str, Any], onboarding_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate platform-specific persona adaptations."""
        
        # Preserve the legacy 8-platform set (all registry platforms except the new podcast).
        platforms = [p["id"] for p in PERSONA_PLATFORMS if p["id"] != "podcast"]
        platform_personas = {}
        
        for platform in platforms:
            try:
                platform_persona = self._generate_single_platform_persona(core_persona, platform, onboarding_data)
                if "error" not in platform_persona:
                    platform_personas[platform] = platform_persona
                else:
                    logger.warning(f"Failed to generate {platform} persona: {platform_persona['error']}")
            except Exception as e:
                logger.error(f"Error generating {platform} persona: {str(e)}")
        
        return platform_personas
    
    def _generate_single_platform_persona(self, core_persona: Dict[str, Any], platform: str, onboarding_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate persona adaptation for a specific platform."""
        
        # Use LinkedIn service for LinkedIn platform
        if platform.lower() == "linkedin":
            return self.linkedin_service.generate_linkedin_persona(core_persona, onboarding_data)
        
        # Use Facebook service for Facebook platform
        if platform.lower() == "facebook":
            return self.facebook_service.generate_facebook_persona(core_persona, onboarding_data)
        
        # Use YouTube service for YouTube platform (video-aware)
        # Unlike the generic text adaptation below, YouTube/Podcast get dedicated
        # audio/video-aware services so their personas capture MEDIA form
        # (tone/pacing, visual style, script structure, prompt_defaults) instead of
        # just writing style. Those services produce the stable BASE persona that
        # Phase 3/4 later inject into episode generation.
        if platform.lower() == "youtube":
            return self.youtube_service.generate_youtube_persona(core_persona, onboarding_data)
        
        # Use Podcast service for Podcast platform (audio/video-aware)
        if platform.lower() == "podcast":
            return self.podcast_service.generate_podcast_persona(core_persona, onboarding_data)
        
        # Use generic platform adaptation for other platforms
        platform_constraints = self._get_platform_constraints(platform)
        prompt = self.prompt_builder.build_platform_adaptation_prompt(core_persona, platform, onboarding_data, platform_constraints)
        
        # Get platform-specific schema
        platform_schema = self.prompt_builder.get_platform_schema()
        
        # Extract user_id for tracking
        user_id = onboarding_data.get("session_info", {}).get("user_id")
        
        try:
            response = llm_text_gen(
                prompt=prompt,
                json_struct=platform_schema,
                temperature=0.2,
                max_tokens=4096,
                system_prompt=f"You are an expert in {platform} content strategy and platform-specific writing optimization.",
                user_id=user_id,
                flow_type=f"{platform}_persona_generation"
            )
            
            return response
            
        except Exception as e:
            logger.error(f"Error generating {platform} persona: {str(e)}")
            return {"error": f"Failed to generate {platform} persona: {str(e)}"}
    
    def _get_platform_constraints(self, platform: str) -> Dict[str, Any]:
        """Get platform-specific constraints (delegates to the platform registry)."""
        return get_platform_constraints(platform)
