from typing import Any, Dict, Optional
import logging

logger = logging.getLogger(__name__)

async def normalize_persona_data(persona_data: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize persona data from onboarding for content strategy autofill.
    
    Args:
        persona_data: Raw persona data from PersonaData model
        
    Returns:
        Normalized persona data structure
    """
    if not persona_data:
        logger.warning("⚠️ normalize_persona_data: Empty persona_data received")
        return {}
    
    logger.warning(f"🔍 normalize_persona_data received keys: {list(persona_data.keys())}")
    
    # E.3 (deferred): raw persona_data read bypasses canonical_profile — route via
    # canonical_profile.persona.platform_personas (verbatim, §5).
    # Extract core persona data
    core_persona = persona_data.get('core_persona') or persona_data.get('corePersona')
    platform_personas = persona_data.get('platform_personas') or persona_data.get('platformPersonas')
    quality_metrics = persona_data.get('quality_metrics') or persona_data.get('qualityMetrics')
    selected_platforms = persona_data.get('selected_platforms') or persona_data.get('selectedPlatforms')
    
    normalized = {
        'core_persona': core_persona or {},
        'platform_personas': platform_personas or {},
        'quality_metrics': quality_metrics or {},
        'selected_platforms': selected_platforms or [],
        'persona_summary': _extract_persona_summary(core_persona, platform_personas),
        'brand_voice_insights': _extract_brand_voice_insights(core_persona, platform_personas),
        'audience_insights': _extract_audience_insights(core_persona)
    }
    
    logger.warning(f"✅ normalize_persona_data output keys: {list(normalized.keys())}")
    return normalized

def _extract_persona_summary(core_persona: Optional[Dict], platform_personas: Optional[Dict]) -> Dict[str, Any]:
    """Extract summary information from persona data."""
    summary = {}
    
    if core_persona:
        summary['archetype'] = core_persona.get('archetype') or core_persona.get('personality_type')
        summary['core_beliefs'] = core_persona.get('core_beliefs') or core_persona.get('beliefs')
        summary['communication_style'] = core_persona.get('communication_style') or core_persona.get('style')
    
    if platform_personas:
        # Extract common traits across platforms
        all_traits = []
        for platform, persona in platform_personas.items():
            if isinstance(persona, dict):
                traits = persona.get('traits') or persona.get('personality_traits') or []
                if isinstance(traits, list):
                    all_traits.extend(traits)
        summary['common_traits'] = list(set(all_traits)) if all_traits else []
    
    return summary

def _extract_brand_voice_insights(core_persona: Optional[Dict], platform_personas: Optional[Dict]) -> Dict[str, Any]:
    """Extract brand voice insights from persona data."""
    insights = {}
    
    if core_persona:
        insights['tone'] = core_persona.get('tone') or core_persona.get('voice_tone')
        insights['personality_traits'] = core_persona.get('personality_traits') or core_persona.get('traits') or []
        insights['communication_style'] = core_persona.get('communication_style') or core_persona.get('style')
        insights['key_messages'] = core_persona.get('key_messages') or core_persona.get('messages') or []
    
    if platform_personas:
        # Extract platform-specific voice adaptations
        platform_voices = {}
        for platform, persona in platform_personas.items():
            if isinstance(persona, dict):
                platform_voices[platform] = {
                    'tone': persona.get('tone'),
                    'style': persona.get('style'),
                    'adaptations': persona.get('adaptations')
                }
        insights['platform_adaptations'] = platform_voices
    
    return insights

def _extract_audience_insights(core_persona: Optional[Dict]) -> Dict[str, Any]:
    """Extract audience insights from persona data."""
    insights = {}
    
    if core_persona:
        demographics = core_persona.get('demographics') or {}
        psychographics = core_persona.get('psychographics') or {}
        
        insights['demographics'] = demographics
        insights['psychographics'] = psychographics
        insights['pain_points'] = psychographics.get('pain_points') or core_persona.get('pain_points') or []
        insights['goals'] = psychographics.get('goals') or core_persona.get('goals') or []
        insights['challenges'] = psychographics.get('challenges') or core_persona.get('challenges') or []
    
    return insights
