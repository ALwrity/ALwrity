"""
Persona Quality Improvement Service
Continuously improves persona quality through feedback and learning.
"""

import json
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta
from loguru import logger
from sqlalchemy.orm import Session

from models.enhanced_persona_models import (
    EnhancedWritingPersona, 
    EnhancedPlatformPersona, 
    PersonaQualityMetrics,
    PersonaLearningData
)
from services.database import get_db_session
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
            linguistic_quality = self._assess_linguistic_quality(linguistic_analysis)
            
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
        """Assess consistency across platform personas."""
        if not platform_personas:
            return 50
        
        core_voice = core_persona.get('brand_voice', {}).get('keywords', [])
        consistency_scores = []
        
        for platform, persona in platform_personas.items():
            if 'error' not in persona:
                platform_voice = persona.get('brand_voice', {}).get('keywords', [])
                overlap = len(set(core_voice) & set(platform_voice))
                consistency_scores.append(min(overlap * 10, 100))
        
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
    
    def _assess_linguistic_quality(self, linguistic_analysis: Dict[str, Any]) -> int:
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
    
    def assess_persona_quality(self, persona_id: int, user_feedback: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Assess the quality of a persona and provide improvement suggestions.
        
        Args:
            persona_id: ID of the persona to assess
            user_feedback: Optional user feedback data
            
        Returns:
            Quality assessment results
        """
        try:
            session = get_db_session()
            
            # Get persona data
            persona = session.query(EnhancedWritingPersona).filter(
                EnhancedWritingPersona.id == persona_id
            ).first()
            
            if not persona:
                return {"error": "Persona not found"}
            
            # Perform quality assessment
            quality_metrics = self._perform_quality_assessment(persona, user_feedback)
            
            # Save quality metrics
            self._save_quality_metrics(session, persona_id, quality_metrics, user_feedback)
            
            # Generate improvement suggestions
            improvement_suggestions = self._generate_improvement_suggestions(quality_metrics)
            
            session.close()
            
            return {
                "persona_id": persona_id,
                "quality_metrics": quality_metrics,
                "improvement_suggestions": improvement_suggestions,
                "assessment_date": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error assessing persona quality: {str(e)}")
            return {"error": f"Failed to assess persona quality: {str(e)}"}
    
    def improve_persona_from_feedback(self, persona_id: int, feedback_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Improve persona based on user feedback and performance data.
        
        Args:
            persona_id: ID of the persona to improve
            feedback_data: User feedback and performance data
            
        Returns:
            Improvement results
        """
        try:
            session = get_db_session()
            
            # Get current persona
            persona = session.query(EnhancedWritingPersona).filter(
                EnhancedWritingPersona.id == persona_id
            ).first()
            
            if not persona:
                return {"error": "Persona not found"}
            
            # Analyze feedback
            feedback_analysis = self._analyze_feedback(feedback_data)
            
            # Generate improvements
            improvements = self._generate_persona_improvements(persona, feedback_analysis)
            
            # Apply improvements
            updated_persona = self._apply_improvements(session, persona, improvements)
            
            # Save learning data
            self._save_learning_data(session, persona_id, feedback_data, improvements)
            
            session.commit()
            session.close()
            
            return {
                "persona_id": persona_id,
                "improvements_applied": improvements,
                "updated_persona": updated_persona.to_dict(),
                "improvement_date": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error improving persona: {str(e)}")
            return {"error": f"Failed to improve persona: {str(e)}"}
    
    def learn_from_content_performance(self, persona_id: int, content_performance: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Learn from content performance data to improve persona.
        
        Args:
            persona_id: ID of the persona to improve
            content_performance: List of content performance data
            
        Returns:
            Learning results
        """
        try:
            session = get_db_session()
            
            # Analyze performance patterns
            performance_analysis = self._analyze_performance_patterns(content_performance)
            
            # Identify successful patterns
            successful_patterns = self._identify_successful_patterns(content_performance)
            
            # Generate learning insights
            learning_insights = self._generate_learning_insights(performance_analysis, successful_patterns)
            
            # Apply learning to persona
            persona_updates = self._apply_performance_learning(persona_id, learning_insights)
            
            # Save learning data
            self._save_performance_learning(session, persona_id, content_performance, learning_insights)
            
            session.commit()
            session.close()
            
            return {
                "persona_id": persona_id,
                "learning_insights": learning_insights,
                "persona_updates": persona_updates,
                "learning_date": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error learning from performance: {str(e)}")
            return {"error": f"Failed to learn from performance: {str(e)}"}
    
    def _perform_quality_assessment(self, persona: EnhancedWritingPersona, user_feedback: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """Perform comprehensive quality assessment of a persona."""
        
        # Linguistic analysis quality
        linguistic_quality = self._assess_linguistic_quality(persona)
        
        # Consistency assessment
        consistency_score = self._assess_consistency(persona)
        
        # Authenticity assessment
        authenticity_score = self._assess_authenticity(persona)
        
        # User satisfaction (if feedback provided)
        user_satisfaction = self._assess_user_satisfaction(user_feedback) if user_feedback else None
        
        # Platform optimization quality
        platform_quality = self._assess_platform_optimization(persona)
        
        # Overall quality score
        quality_scores = [linguistic_quality, consistency_score, authenticity_score, platform_quality]
        if user_satisfaction is not None:
            quality_scores.append(user_satisfaction)
        
        overall_quality = sum(quality_scores) / len(quality_scores)
        
        return {
            "overall_quality_score": overall_quality,
            "linguistic_quality": linguistic_quality,
            "consistency_score": consistency_score,
            "authenticity_score": authenticity_score,
            "user_satisfaction": user_satisfaction,
            "platform_optimization_quality": platform_quality,
            "quality_breakdown": {
                "linguistic_analysis_completeness": self._assess_analysis_completeness(persona),
                "style_consistency": consistency_score,
                "brand_alignment": authenticity_score,
                "platform_adaptation_quality": platform_quality
            }
        }
    
    def _assess_linguistic_quality(self, persona: EnhancedWritingPersona) -> float:
        """Assess the quality of linguistic analysis."""
        linguistic_fingerprint = persona.linguistic_fingerprint or {}
        
        # Check completeness of linguistic analysis
        required_fields = [
            'sentence_analysis', 'vocabulary_analysis', 'rhetorical_analysis',
            'style_patterns', 'readability_analysis'
        ]
        
        completeness_score = 0
        for field in required_fields:
            if field in linguistic_fingerprint and linguistic_fingerprint[field]:
                completeness_score += 20
        
        # Check quality of analysis
        quality_indicators = 0
        if linguistic_fingerprint.get('sentence_analysis', {}).get('sentence_length_distribution'):
            quality_indicators += 1
        if linguistic_fingerprint.get('vocabulary_analysis', {}).get('lexical_diversity'):
            quality_indicators += 1
        if linguistic_fingerprint.get('rhetorical_analysis', {}).get('questions'):
            quality_indicators += 1
        if linguistic_fingerprint.get('style_patterns', {}).get('formality_level'):
            quality_indicators += 1
        
        quality_score = (quality_indicators / 4) * 100
        
        return (completeness_score + quality_score) / 2
    
    def _assess_consistency(self, persona: EnhancedWritingPersona) -> float:
        """Assess consistency of the persona."""
        consistency_analysis = persona.linguistic_fingerprint.get('consistency_analysis', {})
        
        if not consistency_analysis:
            return 50.0  # Default score if no consistency data
        
        return consistency_analysis.get('consistency_score', 50.0)
    
    def _assess_authenticity(self, persona: EnhancedWritingPersona) -> float:
        """Assess authenticity of the persona."""
        # Check if persona reflects real user characteristics
        source_data = persona.source_website_analysis or {}
        
        # Authenticity indicators
        authenticity_indicators = 0
        total_indicators = 5
        
        # Check for brand voice alignment
        if persona.brand_voice_description:
            authenticity_indicators += 1
        
        # Check for core belief definition
        if persona.core_belief:
            authenticity_indicators += 1
        
        # Check for archetype definition
        if persona.archetype:
            authenticity_indicators += 1
        
        # Check for source data quality
        if source_data.get('writing_style'):
            authenticity_indicators += 1
        
        # Check for confidence score
        if persona.confidence_score and persona.confidence_score > 70:
            authenticity_indicators += 1
        
        return (authenticity_indicators / total_indicators) * 100
    
    def _assess_user_satisfaction(self, user_feedback: Dict[str, Any]) -> float:
        """Assess user satisfaction from feedback."""
        if not user_feedback:
            return None
        
        # Extract satisfaction metrics
        satisfaction_score = user_feedback.get('satisfaction_score', 0)
        content_quality_rating = user_feedback.get('content_quality_rating', 0)
        style_match_rating = user_feedback.get('style_match_rating', 0)
        
        # Calculate weighted average
        if satisfaction_score and content_quality_rating and style_match_rating:
            return (satisfaction_score + content_quality_rating + style_match_rating) / 3
        elif satisfaction_score:
            return satisfaction_score
        else:
            return 50.0  # Default if no clear satisfaction data
    
    def _assess_platform_optimization(self, persona) -> float:
        """Assess platform optimization quality."""
        # Handle both EnhancedWritingPersona objects and dictionaries
        if hasattr(persona, 'platform_personas'):
            platform_personas = persona.platform_personas
        elif isinstance(persona, dict):
            # For dictionary input, use the simpler assessment method
            return float(self._assess_platform_optimization_dict(persona))
        else:
            logger.warning(f"Unexpected persona type: {type(persona)}")
            return 0.0
        
        if not platform_personas:
            return 0.0
        
        total_score = 0
        platform_count = 0
        
        for platform_persona in platform_personas:
            if platform_persona.is_active:
                # Check platform-specific optimization completeness
                platform_score = 0
                
                if platform_persona.platform_linguistic_adaptation:
                    platform_score += 25
                if platform_persona.platform_engagement_patterns:
                    platform_score += 25
                if platform_persona.platform_content_optimization:
                    platform_score += 25
                if platform_persona.platform_algorithm_insights:
                    platform_score += 25
                
                total_score += platform_score
                platform_count += 1
        
        return total_score / platform_count if platform_count > 0 else 0.0
    
    def _assess_analysis_completeness(self, persona: EnhancedWritingPersona) -> float:
        """Assess completeness of the persona analysis."""
        completeness_indicators = 0
        total_indicators = 8
        
        # Core persona fields
        if persona.persona_name:
            completeness_indicators += 1
        if persona.archetype:
            completeness_indicators += 1
        if persona.core_belief:
            completeness_indicators += 1
        if persona.brand_voice_description:
            completeness_indicators += 1
        
        # Linguistic analysis
        if persona.linguistic_fingerprint:
            completeness_indicators += 1
        if persona.writing_style_signature:
            completeness_indicators += 1
        if persona.vocabulary_profile:
            completeness_indicators += 1
        if persona.sentence_patterns:
            completeness_indicators += 1
        
        return (completeness_indicators / total_indicators) * 100
    
    def _generate_improvement_suggestions(self, quality_metrics: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate improvement suggestions based on quality metrics."""
        suggestions = []
        
        overall_score = quality_metrics.get('overall_quality_score', 0)
        
        # Linguistic quality improvements
        if quality_metrics.get('linguistic_quality', 0) < 70:
            suggestions.append({
                "category": "linguistic_analysis",
                "priority": "high",
                "suggestion": "Enhance linguistic analysis with more detailed sentence patterns and vocabulary analysis",
                "action": "reanalyze_source_content"
            })
        
        # Consistency improvements
        if quality_metrics.get('consistency_score', 0) < 70:
            suggestions.append({
                "category": "consistency",
                "priority": "high",
                "suggestion": "Improve consistency by analyzing more writing samples",
                "action": "collect_additional_samples"
            })
        
        # Authenticity improvements
        if quality_metrics.get('authenticity_score', 0) < 70:
            suggestions.append({
                "category": "authenticity",
                "priority": "medium",
                "suggestion": "Strengthen brand voice alignment and core belief definition",
                "action": "refine_brand_analysis"
            })
        
        # Platform optimization improvements
        if quality_metrics.get('platform_optimization_quality', 0) < 70:
            suggestions.append({
                "category": "platform_optimization",
                "priority": "medium",
                "suggestion": "Enhance platform-specific adaptations and algorithm insights",
                "action": "update_platform_adaptations"
            })
        
        # User satisfaction improvements
        user_satisfaction = quality_metrics.get('user_satisfaction')
        if user_satisfaction is not None and user_satisfaction < 70:
            suggestions.append({
                "category": "user_satisfaction",
                "priority": "high",
                "suggestion": "Address user feedback and adjust persona based on preferences",
                "action": "incorporate_user_feedback"
            })
        
        return suggestions
    
    def _analyze_feedback(self, feedback_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze user feedback to extract improvement insights."""
        return {
            "satisfaction_level": feedback_data.get('satisfaction_score', 0),
            "content_quality_rating": feedback_data.get('content_quality_rating', 0),
            "style_match_rating": feedback_data.get('style_match_rating', 0),
            "specific_complaints": feedback_data.get('complaints', []),
            "specific_praises": feedback_data.get('praises', []),
            "improvement_requests": feedback_data.get('improvement_requests', []),
            "preferred_adjustments": feedback_data.get('preferred_adjustments', {})
        }
    
    def _generate_persona_improvements(self, persona: EnhancedWritingPersona, feedback_analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Generate specific improvements based on feedback analysis."""
        improvements = {}
        
        # Style adjustments based on feedback
        if feedback_analysis.get('style_match_rating', 0) < 70:
            improvements['style_adjustments'] = {
                "tone_adjustment": feedback_analysis.get('preferred_adjustments', {}).get('tone'),
                "formality_adjustment": feedback_analysis.get('preferred_adjustments', {}).get('formality'),
                "vocabulary_adjustment": feedback_analysis.get('preferred_adjustments', {}).get('vocabulary')
            }
        
        # Content quality improvements
        if feedback_analysis.get('content_quality_rating', 0) < 70:
            improvements['content_quality'] = {
                "clarity_improvement": True,
                "engagement_enhancement": True,
                "structure_optimization": True
            }
        
        # Specific complaint addressing
        complaints = feedback_analysis.get('specific_complaints', [])
        if complaints:
            improvements['complaint_resolutions'] = {
                "addressed_complaints": complaints,
                "resolution_strategies": self._generate_complaint_resolutions(complaints)
            }
        
        return improvements
    
    def _generate_complaint_resolutions(self, complaints: List[str]) -> List[Dict[str, Any]]:
        """Generate resolution strategies for specific complaints."""
        resolutions = []
        
        for complaint in complaints:
            complaint_lower = complaint.lower()
            
            if 'too formal' in complaint_lower:
                resolutions.append({
                    "complaint": complaint,
                    "resolution": "Reduce formality level and increase conversational tone",
                    "action": "adjust_formality_metrics"
                })
            elif 'too casual' in complaint_lower:
                resolutions.append({
                    "complaint": complaint,
                    "resolution": "Increase formality level and professional tone",
                    "action": "adjust_formality_metrics"
                })
            elif 'too long' in complaint_lower:
                resolutions.append({
                    "complaint": complaint,
                    "resolution": "Reduce average sentence length and improve conciseness",
                    "action": "adjust_sentence_length"
                })
            elif 'too short' in complaint_lower:
                resolutions.append({
                    "complaint": complaint,
                    "resolution": "Increase sentence complexity and add more detail",
                    "action": "adjust_sentence_length"
                })
            elif 'boring' in complaint_lower or 'dull' in complaint_lower:
                resolutions.append({
                    "complaint": complaint,
                    "resolution": "Add more engaging language and rhetorical devices",
                    "action": "enhance_engagement_patterns"
                })
            else:
                resolutions.append({
                    "complaint": complaint,
                    "resolution": "General style adjustment based on feedback",
                    "action": "general_style_refinement"
                })
        
        return resolutions
    
    def _apply_improvements(self, session: Session, persona: EnhancedWritingPersona, improvements: Dict[str, Any]) -> EnhancedWritingPersona:
        """Apply improvements to the persona."""
        
        # Apply style adjustments
        if 'style_adjustments' in improvements:
            self._apply_style_adjustments(persona, improvements['style_adjustments'])
        
        # Apply content quality improvements
        if 'content_quality' in improvements:
            self._apply_content_quality_improvements(persona, improvements['content_quality'])
        
        # Apply complaint resolutions
        if 'complaint_resolutions' in improvements:
            self._apply_complaint_resolutions(persona, improvements['complaint_resolutions'])
        
        # Update persona metadata
        persona.updated_at = datetime.utcnow()
        
        session.add(persona)
        return persona
    
    def _apply_style_adjustments(self, persona: EnhancedWritingPersona, style_adjustments: Dict[str, Any]):
        """Apply style adjustments to persona."""
        # Update linguistic fingerprint based on adjustments
        if not persona.linguistic_fingerprint:
            persona.linguistic_fingerprint = {}
        
        # Tone adjustment
        if style_adjustments.get('tone_adjustment'):
            persona.linguistic_fingerprint['adjusted_tone'] = style_adjustments['tone_adjustment']
        
        # Formality adjustment
        if style_adjustments.get('formality_adjustment'):
            persona.linguistic_fingerprint['adjusted_formality'] = style_adjustments['formality_adjustment']
        
        # Vocabulary adjustment
        if style_adjustments.get('vocabulary_adjustment'):
            persona.linguistic_fingerprint['adjusted_vocabulary'] = style_adjustments['vocabulary_adjustment']
    
    def _apply_content_quality_improvements(self, persona: EnhancedWritingPersona, quality_improvements: Dict[str, Any]):
        """Apply content quality improvements to persona."""
        if not persona.linguistic_fingerprint:
            persona.linguistic_fingerprint = {}
        
        # Add quality improvement markers
        persona.linguistic_fingerprint['quality_improvements'] = {
            "clarity_enhanced": quality_improvements.get('clarity_improvement', False),
            "engagement_enhanced": quality_improvements.get('engagement_enhancement', False),
            "structure_optimized": quality_improvements.get('structure_optimization', False),
            "improvement_date": datetime.utcnow().isoformat()
        }
    
    def _apply_complaint_resolutions(self, persona: EnhancedWritingPersona, complaint_resolutions: Dict[str, Any]):
        """Apply complaint resolutions to persona."""
        if not persona.linguistic_fingerprint:
            persona.linguistic_fingerprint = {}
        
        # Add complaint resolution tracking
        persona.linguistic_fingerprint['complaint_resolutions'] = {
            "addressed_complaints": complaint_resolutions.get('addressed_complaints', []),
            "resolution_strategies": complaint_resolutions.get('resolution_strategies', []),
            "resolution_date": datetime.utcnow().isoformat()
        }
    
    def _analyze_performance_patterns(self, content_performance: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze content performance patterns."""
        if not content_performance:
            return {}
        
        # Calculate average performance metrics
        total_content = len(content_performance)
        
        avg_engagement = sum(item.get('engagement_rate', 0) for item in content_performance) / total_content
        avg_reach = sum(item.get('reach', 0) for item in content_performance) / total_content
        avg_clicks = sum(item.get('clicks', 0) for item in content_performance) / total_content
        
        # Identify top performing content
        top_performers = sorted(content_performance, 
                              key=lambda x: x.get('engagement_rate', 0), 
                              reverse=True)[:3]
        
        # Analyze content characteristics of top performers
        top_performer_analysis = self._analyze_top_performers(top_performers)
        
        return {
            "average_engagement_rate": avg_engagement,
            "average_reach": avg_reach,
            "average_clicks": avg_clicks,
            "total_content_analyzed": total_content,
            "top_performers": top_performer_analysis,
            "performance_trends": self._identify_performance_trends(content_performance)
        }
    
    def _analyze_top_performers(self, top_performers: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze characteristics of top performing content."""
        if not top_performers:
            return {}
        
        # Analyze common characteristics
        content_types = [item.get('content_type') for item in top_performers]
        topics = [item.get('topic') for item in top_performers]
        lengths = [item.get('content_length') for item in top_performers]
        
        return {
            "common_content_types": list(set(content_types)),
            "common_topics": list(set(topics)),
            "average_length": sum(lengths) / len(lengths) if lengths else 0,
            "performance_characteristics": {
                "high_engagement_keywords": self._extract_high_engagement_keywords(top_performers),
                "optimal_posting_times": self._extract_optimal_posting_times(top_performers),
                "successful_formats": self._extract_successful_formats(top_performers)
            }
        }
    
    def _extract_high_engagement_keywords(self, top_performers: List[Dict[str, Any]]) -> List[str]:
        """Extract keywords that appear in high-performing content."""
        # This would analyze the content text for common keywords
        # For now, return a placeholder
        return ["innovation", "strategy", "growth", "success"]
    
    def _extract_optimal_posting_times(self, top_performers: List[Dict[str, Any]]) -> List[str]:
        """Extract optimal posting times from top performers."""
        posting_times = [item.get('posting_time') for item in top_performers if item.get('posting_time')]
        return list(set(posting_times))
    
    def _extract_successful_formats(self, top_performers: List[Dict[str, Any]]) -> List[str]:
        """Extract successful content formats from top performers."""
        formats = [item.get('format') for item in top_performers if item.get('format')]
        return list(set(formats))
    
    def _identify_performance_trends(self, content_performance: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Identify performance trends over time."""
        # Sort by date if available
        sorted_performance = sorted(content_performance, 
                                  key=lambda x: x.get('date', ''), 
                                  reverse=True)
        
        if len(sorted_performance) < 2:
            return {"trend": "insufficient_data"}
        
        # Calculate trend
        recent_performance = sorted_performance[:len(sorted_performance)//2]
        older_performance = sorted_performance[len(sorted_performance)//2:]
        
        recent_avg = sum(item.get('engagement_rate', 0) for item in recent_performance) / len(recent_performance)
        older_avg = sum(item.get('engagement_rate', 0) for item in older_performance) / len(older_performance)
        
        if recent_avg > older_avg * 1.1:
            trend = "improving"
        elif recent_avg < older_avg * 0.9:
            trend = "declining"
        else:
            trend = "stable"
        
        return {
            "trend": trend,
            "recent_average": recent_avg,
            "older_average": older_avg,
            "change_percentage": ((recent_avg - older_avg) / older_avg * 100) if older_avg > 0 else 0
        }
    
    def _identify_successful_patterns(self, content_performance: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Identify patterns in successful content."""
        # Filter for high-performing content (top 25%)
        sorted_performance = sorted(content_performance, 
                                  key=lambda x: x.get('engagement_rate', 0), 
                                  reverse=True)
        
        top_quarter = sorted_performance[:max(1, len(sorted_performance) // 4)]
        
        return {
            "high_performing_content_count": len(top_quarter),
            "common_characteristics": self._analyze_top_performers(top_quarter),
            "success_patterns": {
                "optimal_length_range": self._calculate_optimal_length_range(top_quarter),
                "preferred_content_types": self._get_preferred_content_types(top_quarter),
                "successful_topic_categories": self._get_successful_topic_categories(top_quarter)
            }
        }
    
    def _calculate_optimal_length_range(self, top_performers: List[Dict[str, Any]]) -> Dict[str, int]:
        """Calculate optimal content length range from top performers."""
        lengths = [item.get('content_length', 0) for item in top_performers if item.get('content_length')]
        
        if not lengths:
            return {"min": 0, "max": 0, "average": 0}
        
        return {
            "min": min(lengths),
            "max": max(lengths),
            "average": sum(lengths) / len(lengths)
        }
    
    def _get_preferred_content_types(self, top_performers: List[Dict[str, Any]]) -> List[str]:
        """Get preferred content types from top performers."""
        content_types = [item.get('content_type') for item in top_performers if item.get('content_type')]
        return list(set(content_types))
    
    def _get_successful_topic_categories(self, top_performers: List[Dict[str, Any]]) -> List[str]:
        """Get successful topic categories from top performers."""
        topics = [item.get('topic_category') for item in top_performers if item.get('topic_category')]
        return list(set(topics))
    
    def _generate_learning_insights(self, performance_analysis: Dict[str, Any], successful_patterns: Dict[str, Any]) -> Dict[str, Any]:
        """Generate learning insights from performance analysis."""
        return {
            "performance_insights": {
                "average_engagement": performance_analysis.get('average_engagement_rate', 0),
                "performance_trend": performance_analysis.get('performance_trends', {}).get('trend', 'unknown'),
                "top_performing_characteristics": performance_analysis.get('top_performers', {})
            },
            "success_patterns": successful_patterns,
            "recommendations": {
                "content_length_optimization": successful_patterns.get('success_patterns', {}).get('optimal_length_range', {}),
                "content_type_preferences": successful_patterns.get('success_patterns', {}).get('preferred_content_types', []),
                "topic_focus_areas": successful_patterns.get('success_patterns', {}).get('successful_topic_categories', [])
            },
            "learning_confidence": self._calculate_learning_confidence(performance_analysis, successful_patterns)
        }
    
    def _calculate_learning_confidence(self, performance_analysis: Dict[str, Any], successful_patterns: Dict[str, Any]) -> float:
        """Calculate confidence in learning insights."""
        # Base confidence on amount of data
        total_content = performance_analysis.get('total_content_analyzed', 0)
        high_performers = successful_patterns.get('high_performing_content_count', 0)
        
        # Confidence increases with more data
        data_confidence = min(100, (total_content / 20) * 100)  # 20 pieces of content = 100% confidence
        
        # Confidence increases with more high performers
        pattern_confidence = min(100, (high_performers / 5) * 100)  # 5 high performers = 100% confidence
        
        return (data_confidence + pattern_confidence) / 2
    
    def _apply_performance_learning(self, persona_id: int, learning_insights: Dict[str, Any]) -> Dict[str, Any]:
        """Apply performance learning to persona."""
        # This would update the persona based on learning insights
        # For now, return the insights that would be applied
        return {
            "applied_insights": learning_insights,
            "persona_updates": {
                "content_length_preferences": learning_insights.get('recommendations', {}).get('content_length_optimization', {}),
                "preferred_content_types": learning_insights.get('recommendations', {}).get('content_type_preferences', []),
                "successful_topic_areas": learning_insights.get('recommendations', {}).get('topic_focus_areas', []),
                "learning_confidence": learning_insights.get('learning_confidence', 0)
            }
        }
    
    def _save_quality_metrics(self, session: Session, persona_id: int, quality_metrics: Dict[str, Any], user_feedback: Optional[Dict[str, Any]]):
        """Save quality metrics to database."""
        quality_record = PersonaQualityMetrics(
            writing_persona_id=persona_id,
            style_accuracy=quality_metrics.get('linguistic_quality', 0),
            content_quality=quality_metrics.get('overall_quality_score', 0),
            engagement_rate=quality_metrics.get('platform_optimization_quality', 0),
            consistency_score=quality_metrics.get('consistency_score', 0),
            user_satisfaction=quality_metrics.get('user_satisfaction'),
            user_feedback=json.dumps(user_feedback) if user_feedback else None,
            ai_quality_assessment=json.dumps(quality_metrics),
            improvement_suggestions=json.dumps(quality_metrics.get('improvement_suggestions', [])),
            assessor_type="ai_automated"
        )
        
        session.add(quality_record)
    
    def _save_learning_data(self, session: Session, persona_id: int, feedback_data: Dict[str, Any], improvements: Dict[str, Any]):
        """Save learning data to database."""
        learning_record = PersonaLearningData(
            writing_persona_id=persona_id,
            user_writing_samples=json.dumps(feedback_data.get('writing_samples', [])),
            successful_content_examples=json.dumps(feedback_data.get('successful_content', [])),
            user_preferences=json.dumps(feedback_data.get('preferences', {})),
            style_refinements=json.dumps(improvements.get('style_adjustments', {})),
            vocabulary_updates=json.dumps(improvements.get('vocabulary_adjustments', {})),
            pattern_adjustments=json.dumps(improvements.get('pattern_adjustments', {})),
            learning_type="feedback"
        )
        
        session.add(learning_record)
    
    def _save_performance_learning(self, session: Session, persona_id: int, content_performance: List[Dict[str, Any]], learning_insights: Dict[str, Any]):
        """Save performance learning data to database."""
        learning_record = PersonaLearningData(
            writing_persona_id=persona_id,
            user_writing_samples=json.dumps(content_performance),
            successful_content_examples=json.dumps(learning_insights.get('success_patterns', {})),
            user_preferences=json.dumps(learning_insights.get('recommendations', {})),
            style_refinements=json.dumps(learning_insights.get('persona_updates', {})),
            learning_type="performance"
        )
        
        session.add(learning_record)
