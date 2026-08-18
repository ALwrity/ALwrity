"""
Persona Quality Improvement Service
Continuously improves persona quality through feedback and learning.
"""

from typing import Dict, Any, List, Optional
from loguru import logger

from services.persona.enhanced_linguistic_analyzer import get_linguistic_analyzer

class PersonaQualityImprover:
    """Service for continuously improving persona quality and accuracy."""
    
    def __init__(self, linguistic_analyzer=None):
        """Initialize the quality improver."""
        self.linguistic_analyzer = linguistic_analyzer or get_linguistic_analyzer()
        logger.debug("PersonaQualityImprover initialized")
    
    def assess_persona_quality_comprehensive(
        self, 
        core_persona: Dict[str, Any], 
        platform_personas: Dict[str, Any], 
        linguistic_analysis: Dict[str, Any],
        user_preferences: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Comprehensive quality assessment for quality-first approach.
        """
        try:
            # Calculate comprehensive quality metrics
            quality_metrics = self._calculate_comprehensive_quality_metrics(
                core_persona, platform_personas, linguistic_analysis, user_preferences
            )
            
            # Generate detailed recommendations
            recommendations = self._generate_comprehensive_recommendations(quality_metrics, linguistic_analysis)
            
            return {
                "overall_score": quality_metrics.get('overall_score', 0),
                "core_completeness": quality_metrics.get('core_completeness', 0),
                "platform_consistency": quality_metrics.get('platform_consistency', 0),
                "platform_optimization": quality_metrics.get('platform_optimization', 0),
                "linguistic_quality": quality_metrics.get('linguistic_quality', 0),
                "recommendations": recommendations,
                "assessment_method": "comprehensive_ai_based",
                "linguistic_insights": linguistic_analysis,
                "detailed_metrics": quality_metrics
            }
            
        except Exception as e:
            logger.error(f"Comprehensive quality assessment error: {str(e)}")
            return {
                "overall_score": 75,
                "core_completeness": 75,
                "platform_consistency": 75,
                "platform_optimization": 75,
                "linguistic_quality": 75,
                "recommendations": ["Quality assessment completed with default metrics"],
                "error": str(e)
            }
    
    def improve_persona_quality(
        self,
        core_persona: Dict[str, Any],
        platform_personas: Dict[str, Any],
        quality_metrics: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Improve persona quality based on assessment results.
        """
        try:
            logger.info("Improving persona quality based on assessment results...")
            
            improved_core_persona = self._improve_core_persona(core_persona, quality_metrics)
            improved_platform_personas = self._improve_platform_personas(platform_personas, quality_metrics)
            
            return {
                "core_persona": improved_core_persona,
                "platform_personas": improved_platform_personas,
                "improvement_applied": True,
                "improvement_details": "Quality improvements applied based on assessment results"
            }
            
        except Exception as e:
            logger.error(f"Persona quality improvement error: {str(e)}")
            return {"error": f"Failed to improve persona quality: {str(e)}"}
    
    def _calculate_comprehensive_quality_metrics(
        self, 
        core_persona: Dict[str, Any], 
        platform_personas: Dict[str, Any], 
        linguistic_analysis: Dict[str, Any],
        user_preferences: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Calculate comprehensive quality metrics."""
        try:
            # Core completeness (30% weight)
            core_completeness = self._assess_core_completeness(core_persona, linguistic_analysis)
            
            # Platform consistency (25% weight)
            platform_consistency = self._assess_platform_consistency(core_persona, platform_personas)
            
            # Platform optimization (25% weight)
            platform_optimization = self._assess_platform_optimization_dict(platform_personas)
            
            # Linguistic quality (20% weight)
            linguistic_quality = self._assess_linguistic_quality_dict(linguistic_analysis)
            
            # Calculate weighted overall score
            overall_score = int((
                core_completeness * 0.30 +
                platform_consistency * 0.25 +
                platform_optimization * 0.25 +
                linguistic_quality * 0.20
            ))
            
            return {
                "overall_score": overall_score,
                "core_completeness": core_completeness,
                "platform_consistency": platform_consistency,
                "platform_optimization": platform_optimization,
                "linguistic_quality": linguistic_quality,
                "weights": {
                    "core_completeness": 0.30,
                    "platform_consistency": 0.25,
                    "platform_optimization": 0.25,
                    "linguistic_quality": 0.20
                }
            }
            
        except Exception as e:
            logger.error(f"Error calculating comprehensive quality metrics: {str(e)}")
            return {
                "overall_score": 75,
                "core_completeness": 75,
                "platform_consistency": 75,
                "platform_optimization": 75,
                "linguistic_quality": 75
            }
    
    def _assess_core_completeness(self, core_persona: Dict[str, Any], linguistic_analysis: Dict[str, Any]) -> int:
        """Assess core persona completeness."""
        required_sections = ['writing_style', 'content_characteristics', 'brand_voice', 'target_audience']
        present_sections = sum(1 for section in required_sections if section in core_persona and core_persona[section])
        
        base_score = int((present_sections / len(required_sections)) * 100)
        
        # Boost if linguistic analysis provides additional insights
        if linguistic_analysis and linguistic_analysis.get('analysis_completeness', 0) > 0.8:
            base_score = min(base_score + 10, 100)
        
        return base_score
    
    def _assess_platform_consistency(self, core_persona: Dict[str, Any], platform_personas: Dict[str, Any]) -> int:
        """Assess consistency across platform personas.

        The legacy ``brand_voice.keywords`` overlap heuristic was retired with the
        legacy persona schema (E.4). The new ``core_persona``/``platform_persona``
        schema has no keyword lists (voice is a description string, tone lives in
        ``tonal_range.default_tone``), so return a neutral score rather than a
        misleading 0 until a tone-based consistency check is introduced.
        """
        if not platform_personas:
            return 50

        core_tone = (core_persona.get('tonal_range') or {}).get('default_tone', '')
        consistency_scores = []
        for platform, persona in platform_personas.items():
            if 'error' not in persona:
                platform_tone = (persona.get('tonal_range') or {}).get('default_tone', '')
                if not core_tone or not platform_tone:
                    consistency_scores.append(75)
                elif core_tone == platform_tone:
                    consistency_scores.append(100)
                else:
                    consistency_scores.append(50)

        return int(sum(consistency_scores) / len(consistency_scores)) if consistency_scores else 75
    
    def _assess_platform_optimization_dict(self, platform_personas: Dict[str, Any]) -> int:
        """Assess platform-specific optimization quality for dictionary input."""
        if not platform_personas:
            return 50
        
        optimization_scores = []
        for platform, persona in platform_personas.items():
            if 'error' not in persona:
                has_optimizations = any(key in persona for key in [
                    'platform_optimizations', 'content_guidelines', 'engagement_strategies'
                ])
                optimization_scores.append(90 if has_optimizations else 60)
        
        return int(sum(optimization_scores) / len(optimization_scores)) if optimization_scores else 75
    
    def _assess_linguistic_quality_dict(self, linguistic_analysis: Dict[str, Any]) -> int:
        """Assess linguistic analysis quality."""
        if not linguistic_analysis:
            return 50
        
        quality_indicators = [
            'analysis_completeness',
            'style_consistency', 
            'vocabulary_sophistication',
            'content_coherence'
        ]
        
        scores = [linguistic_analysis.get(indicator, 0.5) for indicator in quality_indicators]
        return int(sum(scores) / len(scores) * 100)
    
    def _generate_comprehensive_recommendations(self, quality_metrics: Dict[str, Any], linguistic_analysis: Dict[str, Any]) -> List[str]:
        """Generate comprehensive quality recommendations."""
        recommendations = []
        
        if quality_metrics.get('core_completeness', 0) < 85:
            recommendations.append("Enhance core persona with more detailed writing style characteristics and brand voice elements")
        
        if quality_metrics.get('platform_consistency', 0) < 80:
            recommendations.append("Improve brand voice consistency across all platform adaptations")
        
        if quality_metrics.get('platform_optimization', 0) < 85:
            recommendations.append("Strengthen platform-specific optimizations and engagement strategies")
        
        if quality_metrics.get('linguistic_quality', 0) < 80:
            recommendations.append("Improve linguistic quality and writing sophistication")
        
        # Add linguistic-specific recommendations
        if linguistic_analysis:
            if linguistic_analysis.get('style_consistency', 0) < 0.7:
                recommendations.append("Enhance writing style consistency across content samples")
            
            if linguistic_analysis.get('vocabulary_sophistication', 0) < 0.7:
                recommendations.append("Increase vocabulary sophistication for better audience engagement")
        
        if not recommendations:
            recommendations.append("Your personas demonstrate excellent quality across all assessment criteria!")
        
        return recommendations
    
    def _improve_core_persona(self, core_persona: Dict[str, Any], quality_metrics: Dict[str, Any]) -> Dict[str, Any]:
        """Improve core persona based on quality metrics."""
        improved_persona = core_persona.copy()
        
        # Enhance based on quality gaps
        if quality_metrics.get('core_completeness', 0) < 85:
            # Add more detailed characteristics
            if 'writing_style' not in improved_persona:
                improved_persona['writing_style'] = {}
            
            if 'sentence_structure' not in improved_persona['writing_style']:
                improved_persona['writing_style']['sentence_structure'] = 'Varied and engaging'
            
            if 'vocabulary_level' not in improved_persona['writing_style']:
                improved_persona['writing_style']['vocabulary_level'] = 'Professional with accessible language'
        
        return improved_persona
    
    def _improve_platform_personas(self, platform_personas: Dict[str, Any], quality_metrics: Dict[str, Any]) -> Dict[str, Any]:
        """Improve platform personas based on quality metrics."""
        improved_personas = platform_personas.copy()
        
        # Enhance each platform persona
        for platform, persona in improved_personas.items():
            if 'error' not in persona:
                # Add platform-specific optimizations if missing
                if 'platform_optimizations' not in persona:
                    persona['platform_optimizations'] = self._get_default_platform_optimizations(platform)
                
                # Enhance engagement strategies
                if 'engagement_strategies' not in persona:
                    persona['engagement_strategies'] = self._get_default_engagement_strategies(platform)
        
        return improved_personas
    
    def _get_default_platform_optimizations(self, platform: str) -> Dict[str, Any]:
        """Get default platform optimizations."""
        optimizations = {
            'linkedin': {
                'professional_networking': True,
                'thought_leadership': True,
                'industry_insights': True
            },
            'facebook': {
                'community_building': True,
                'social_engagement': True,
                'visual_storytelling': True
            },
            'twitter': {
                'real_time_updates': True,
                'hashtag_optimization': True,
                'concise_messaging': True
            },
            'blog': {
                'seo_optimization': True,
                'long_form_content': True,
                'storytelling': True
            }
        }
        return optimizations.get(platform, {})
    
    def _get_default_engagement_strategies(self, platform: str) -> Dict[str, Any]:
        """Get default engagement strategies."""
        strategies = {
            'linkedin': {
                'call_to_action': 'Connect with me to discuss',
                'engagement_style': 'Professional networking'
            },
            'facebook': {
                'call_to_action': 'Join our community',
                'engagement_style': 'Social interaction'
            },
            'twitter': {
                'call_to_action': 'Follow for updates',
                'engagement_style': 'Real-time conversation'
            },
            'blog': {
                'call_to_action': 'Subscribe for more insights',
                'engagement_style': 'Educational content'
            }
        }
        return strategies.get(platform, {})
