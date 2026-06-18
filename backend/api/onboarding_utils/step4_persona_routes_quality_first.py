"""
QUALITY-FIRST Step 4 Persona Generation Routes
Prioritizes persona quality over cost optimization.
Uses multiple specialized API calls for maximum quality and accuracy.
"""

import asyncio
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
from loguru import logger

from services.persona.core_persona.core_persona_service import CorePersonaService
from services.persona.enhanced_linguistic_analyzer import get_linguistic_analyzer
from services.persona.persona_quality_improver import PersonaQualityImprover
from middleware.auth_middleware import get_current_user

router = APIRouter()

# Initialize services
core_persona_service = CorePersonaService()
linguistic_analyzer = get_linguistic_analyzer()
quality_improver = PersonaQualityImprover(linguistic_analyzer)

class QualityFirstPersonaRequest(BaseModel):
    """Quality-first request model for persona generation."""
    onboarding_data: Dict[str, Any]
    selected_platforms: List[str] = ["linkedin", "blog"]
    user_preferences: Optional[Dict[str, Any]] = None
    quality_threshold: float = 85.0  # Minimum quality score required

class QualityFirstPersonaResponse(BaseModel):
    """Quality-first response model for persona generation."""
    success: bool
    core_persona: Optional[Dict[str, Any]] = None
    platform_personas: Optional[Dict[str, Any]] = None
    quality_metrics: Optional[Dict[str, Any]] = None
    linguistic_analysis: Optional[Dict[str, Any]] = None
    api_call_count: Optional[int] = None
    execution_time_ms: Optional[int] = None
    quality_validation_passed: Optional[bool] = None
    error: Optional[str] = None

@router.post("/step4/generate-personas-quality-first", response_model=QualityFirstPersonaResponse)
async def generate_writing_personas_quality_first(
    request: QualityFirstPersonaRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    QUALITY-FIRST persona generation with multiple specialized API calls for maximum quality.
    
    QUALITY-FIRST APPROACH:
    1. Enhanced linguistic analysis (spaCy required)
    2. Core persona generation with detailed prompts
    3. Individual platform adaptations (specialized for each platform)
    4. Comprehensive quality assessment using AI
    5. Quality validation and improvement if needed
    
    Total API calls: 1 (core) + N (platforms) + 1 (quality) = N + 2 calls
    Quality priority: MAXIMUM (no compromises)
    """
    import time
    start_time = time.time()
    api_call_count = 0
    quality_validation_passed = False
    
    try:
        logger.info(f"🎯 Starting QUALITY-FIRST persona generation for user: {current_user.get('user_id', 'unknown')}")
        logger.info(f"📋 Selected platforms: {request.selected_platforms}")
        logger.info(f"🎖️ Quality threshold: {request.quality_threshold}%")
        
        # Step 1: Enhanced linguistic analysis (REQUIRED for quality)
        logger.info("Step 1: Enhanced linguistic analysis...")
        text_samples = extract_text_samples_for_analysis(request.onboarding_data)
        if text_samples:
            linguistic_analysis = await asyncio.get_event_loop().run_in_executor(
                None,
                linguistic_analyzer.analyze_writing_style,
                text_samples
            )
            logger.info("✅ Enhanced linguistic analysis completed")
        else:
            logger.warning("⚠️ No text samples found for linguistic analysis")
            linguistic_analysis = {}
        
        # Step 2: Generate core persona with enhanced analysis
        logger.info("Step 2: Generating core persona with enhanced linguistic insights...")
        enhanced_onboarding_data = request.onboarding_data.copy()
        enhanced_onboarding_data['linguistic_analysis'] = linguistic_analysis
        
        core_persona = await asyncio.get_event_loop().run_in_executor(
            None, 
            core_persona_service.generate_core_persona, 
            enhanced_onboarding_data
        )
        api_call_count += 1
        
        if "error" in core_persona:
            raise Exception(f"Core persona generation failed: {core_persona['error']}")
        
        logger.info("✅ Core persona generated successfully")
        
        # Step 3: Generate individual platform adaptations (specialized for each platform)
        logger.info(f"Step 3: Generating specialized platform adaptations for: {request.selected_platforms}")
        platform_tasks = []
        
        for platform in request.selected_platforms:
            task = asyncio.create_task(
                generate_specialized_platform_persona_async(
                    core_persona, 
                    platform, 
                    enhanced_onboarding_data,
                    linguistic_analysis
                )
            )
            platform_tasks.append((platform, task))
        
        # Wait for all platform personas to complete
        platform_results = await asyncio.gather(
            *[task for _, task in platform_tasks],
            return_exceptions=True
        )
        
        # Process platform results
        platform_personas = {}
        for i, (platform, task) in enumerate(platform_tasks):
            result = platform_results[i]
            if isinstance(result, Exception):
                logger.error(f"❌ Platform {platform} generation failed: {str(result)}")
                raise Exception(f"Platform {platform} generation failed: {str(result)}")
            elif "error" in result:
                logger.error(f"❌ Platform {platform} generation failed: {result['error']}")
                raise Exception(f"Platform {platform} generation failed: {result['error']}")
            else:
                platform_personas[platform] = result
                api_call_count += 1
        
        logger.info(f"✅ Platform adaptations generated for {len(platform_personas)} platforms")
        
        # Step 4: Comprehensive AI-based quality assessment
        logger.info("Step 4: Comprehensive AI-based quality assessment...")
        quality_metrics = await assess_persona_quality_ai_based(
            core_persona, 
            platform_personas,
            linguistic_analysis,
            request.user_preferences
        )
        api_call_count += 1
        
        # Step 5: Quality validation
        logger.info("Step 5: Quality validation...")
        overall_quality = quality_metrics.get('overall_score', 0)
        
        if overall_quality >= request.quality_threshold:
            quality_validation_passed = True
            logger.info(f"✅ Quality validation PASSED: {overall_quality}% >= {request.quality_threshold}%")
        else:
            logger.warning(f"⚠️ Quality validation FAILED: {overall_quality}% < {request.quality_threshold}%")
            
            # Attempt quality improvement
            logger.info("🔄 Attempting quality improvement...")
            improved_personas = await attempt_quality_improvement(
                core_persona,
                platform_personas,
                quality_metrics,
                request.quality_threshold
            )
            
            if improved_personas:
                core_persona = improved_personas.get('core_persona', core_persona)
                platform_personas = improved_personas.get('platform_personas', platform_personas)
                
                # Re-assess quality after improvement
                quality_metrics = await assess_persona_quality_ai_based(
                    core_persona, 
                    platform_personas,
                    linguistic_analysis,
                    request.user_preferences
                )
                api_call_count += 1
                
                final_quality = quality_metrics.get('overall_score', 0)
                if final_quality >= request.quality_threshold:
                    quality_validation_passed = True
                    logger.info(f"✅ Quality improvement SUCCESSFUL: {final_quality}% >= {request.quality_threshold}%")
                else:
                    logger.warning(f"⚠️ Quality improvement INSUFFICIENT: {final_quality}% < {request.quality_threshold}%")
            else:
                logger.error("❌ Quality improvement failed")
        
        execution_time_ms = int((time.time() - start_time) * 1000)
        
        # Log quality-first performance metrics
        total_platforms = len(request.selected_platforms)
        successful_platforms = len([p for p in platform_personas.values() if "error" not in p])
        logger.info(f"🎯 QUALITY-FIRST persona generation completed in {execution_time_ms}ms")
        logger.info(f"📊 API calls made: {api_call_count} (quality-focused approach)")
        logger.info(f"🎖️ Final quality score: {quality_metrics.get('overall_score', 0)}%")
        logger.info(f"✅ Quality validation: {'PASSED' if quality_validation_passed else 'FAILED'}")
        logger.info(f"🎯 Success rate: {successful_platforms}/{total_platforms} platforms successful")
        
        return QualityFirstPersonaResponse(
            success=True,
            core_persona=core_persona,
            platform_personas=platform_personas,
            quality_metrics=quality_metrics,
            linguistic_analysis=linguistic_analysis,
            api_call_count=api_call_count,
            execution_time_ms=execution_time_ms,
            quality_validation_passed=quality_validation_passed
        )
        
    except Exception as e:
        execution_time_ms = int((time.time() - start_time) * 1000)
        logger.error(f"❌ Quality-first persona generation error: {str(e)}")
        return QualityFirstPersonaResponse(
            success=False,
            api_call_count=api_call_count,
            execution_time_ms=execution_time_ms,
            quality_validation_passed=False,
            error=f"Quality-first persona generation failed: {str(e)}"
        )

async def generate_specialized_platform_persona_async(
    core_persona: Dict[str, Any],
    platform: str,
    onboarding_data: Dict[str, Any],
    linguistic_analysis: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Generate specialized platform persona with enhanced context.
    """
    try:
        # Add linguistic analysis to onboarding data for platform-specific generation
        enhanced_data = onboarding_data.copy()
        enhanced_data['linguistic_analysis'] = linguistic_analysis
        
        return await asyncio.get_event_loop().run_in_executor(
            None,
            core_persona_service._generate_single_platform_persona,
            core_persona,
            platform,
            enhanced_data
        )
    except Exception as e:
        logger.error(f"Error generating specialized {platform} persona: {str(e)}")
        return {"error": f"Failed to generate specialized {platform} persona: {str(e)}"}

async def assess_persona_quality_ai_based(
    core_persona: Dict[str, Any],
    platform_personas: Dict[str, Any],
    linguistic_analysis: Dict[str, Any],
    user_preferences: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    AI-based quality assessment using the persona quality improver.
    """
    try:
        # Use the actual PersonaQualityImprover for AI-based assessment
        assessment_result = await asyncio.get_event_loop().run_in_executor(
            None,
            quality_improver.assess_persona_quality_comprehensive,
            core_persona,
            platform_personas,
            linguistic_analysis,
            user_preferences
        )
        
        return assessment_result
        
    except Exception as e:
        logger.error(f"AI-based quality assessment error: {str(e)}")
        # Fallback to enhanced rule-based assessment
        return await assess_persona_quality_enhanced_rule_based(
            core_persona, platform_personas, linguistic_analysis
        )

async def assess_persona_quality_enhanced_rule_based(
    core_persona: Dict[str, Any],
    platform_personas: Dict[str, Any],
    linguistic_analysis: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Enhanced rule-based quality assessment with linguistic analysis.
    """
    try:
        # Calculate quality scores with linguistic insights
        core_completeness = calculate_enhanced_completeness_score(core_persona, linguistic_analysis)
        platform_consistency = calculate_enhanced_consistency_score(core_persona, platform_personas, linguistic_analysis)
        platform_optimization = calculate_enhanced_platform_optimization_score(platform_personas, linguistic_analysis)
        linguistic_quality = calculate_linguistic_quality_score(linguistic_analysis)
        
        # Weighted overall score (linguistic quality is important)
        overall_score = int((
            core_completeness * 0.25 +
            platform_consistency * 0.25 +
            platform_optimization * 0.25 +
            linguistic_quality * 0.25
        ))
        
        # Generate enhanced recommendations
        recommendations = generate_enhanced_quality_recommendations(
            core_completeness, platform_consistency, platform_optimization, linguistic_quality, linguistic_analysis
        )
        
        return {
            "overall_score": overall_score,
            "core_completeness": core_completeness,
            "platform_consistency": platform_consistency,
            "platform_optimization": platform_optimization,
            "linguistic_quality": linguistic_quality,
            "recommendations": recommendations,
            "assessment_method": "enhanced_rule_based",
            "linguistic_insights": linguistic_analysis
        }
        
    except Exception as e:
        logger.error(f"Enhanced rule-based quality assessment error: {str(e)}")
        return {
            "overall_score": 70,
            "core_completeness": 70,
            "platform_consistency": 70,
            "platform_optimization": 70,
            "linguistic_quality": 70,
            "recommendations": ["Quality assessment completed with default metrics"],
            "error": str(e)
        }

def calculate_enhanced_completeness_score(core_persona: Dict[str, Any], linguistic_analysis: Dict[str, Any]) -> int:
    """Calculate enhanced completeness score with linguistic insights."""
    required_fields = ['writing_style', 'content_characteristics', 'brand_voice', 'target_audience']
    present_fields = sum(1 for field in required_fields if field in core_persona and core_persona[field])
    base_score = int((present_fields / len(required_fields)) * 100)
    
    # Boost score if linguistic analysis is available and comprehensive
    if linguistic_analysis and linguistic_analysis.get('analysis_completeness', 0) > 0.8:
        base_score = min(base_score + 10, 100)
    
    return base_score

def calculate_enhanced_consistency_score(
    core_persona: Dict[str, Any], 
    platform_personas: Dict[str, Any], 
    linguistic_analysis: Dict[str, Any]
) -> int:
    """Calculate enhanced consistency score with linguistic insights."""
    if not platform_personas:
        return 50
    
    # Check if brand voice elements are consistent across platforms
    core_voice = core_persona.get('brand_voice', {}).get('keywords', [])
    consistency_scores = []
    
    for platform, persona in platform_personas.items():
        if 'error' not in persona:
            platform_voice = persona.get('brand_voice', {}).get('keywords', [])
            # Enhanced consistency check with linguistic analysis
            overlap = len(set(core_voice) & set(platform_voice))
            consistency_score = min(overlap * 10, 100)
            
            # Boost if linguistic analysis shows good style consistency
            if linguistic_analysis and linguistic_analysis.get('style_consistency', 0) > 0.8:
                consistency_score = min(consistency_score + 5, 100)
            
            consistency_scores.append(consistency_score)
    
    return int(sum(consistency_scores) / len(consistency_scores)) if consistency_scores else 75

def calculate_enhanced_platform_optimization_score(
    platform_personas: Dict[str, Any], 
    linguistic_analysis: Dict[str, Any]
) -> int:
    """Calculate enhanced platform optimization score."""
    if not platform_personas:
        return 50
    
    optimization_scores = []
    for platform, persona in platform_personas.items():
        if 'error' not in persona:
            # Check for platform-specific optimizations
            has_optimizations = any(key in persona for key in [
                'platform_optimizations', 'content_guidelines', 'engagement_strategies'
            ])
            base_score = 90 if has_optimizations else 60
            
            # Boost if linguistic analysis shows good adaptation potential
            if linguistic_analysis and linguistic_analysis.get('adaptation_potential', 0) > 0.8:
                base_score = min(base_score + 10, 100)
            
            optimization_scores.append(base_score)
    
    return int(sum(optimization_scores) / len(optimization_scores)) if optimization_scores else 75

def calculate_linguistic_quality_score(linguistic_analysis: Dict[str, Any]) -> int:
    """Calculate linguistic quality score from enhanced analysis."""
    if not linguistic_analysis:
        return 50
    
    # Score based on linguistic analysis completeness and quality indicators
    completeness = linguistic_analysis.get('analysis_completeness', 0.5)
    style_consistency = linguistic_analysis.get('style_consistency', 0.5)
    vocabulary_sophistication = linguistic_analysis.get('vocabulary_sophistication', 0.5)
    
    return int((completeness + style_consistency + vocabulary_sophistication) / 3 * 100)

def generate_enhanced_quality_recommendations(
    core_completeness: int,
    platform_consistency: int,
    platform_optimization: int,
    linguistic_quality: int,
    linguistic_analysis: Dict[str, Any]
) -> List[str]:
    """Generate enhanced quality recommendations with linguistic insights."""
    recommendations = []
    
    if core_completeness < 85:
        recommendations.append("Enhance core persona completeness with more detailed writing style characteristics")
    
    if platform_consistency < 80:
        recommendations.append("Improve brand voice consistency across platform adaptations")
    
    if platform_optimization < 85:
        recommendations.append("Strengthen platform-specific optimizations for better engagement")
    
    if linguistic_quality < 80:
        recommendations.append("Improve linguistic quality and writing style sophistication")
    
    # Add linguistic-specific recommendations
    if linguistic_analysis:
        if linguistic_analysis.get('style_consistency', 0) < 0.7:
            recommendations.append("Enhance writing style consistency across content samples")
        
        if linguistic_analysis.get('vocabulary_sophistication', 0) < 0.7:
            recommendations.append("Increase vocabulary sophistication for better engagement")
    
    if not recommendations:
        recommendations.append("Your personas show excellent quality across all metrics!")
    
    return recommendations

async def attempt_quality_improvement(
    core_persona: Dict[str, Any],
    platform_personas: Dict[str, Any],
    quality_metrics: Dict[str, Any],
    quality_threshold: float
) -> Optional[Dict[str, Any]]:
    """
    Attempt to improve persona quality if it doesn't meet the threshold.
    """
    try:
        logger.info("🔄 Attempting persona quality improvement...")
        
        # Use PersonaQualityImprover for actual improvement
        improvement_result = await asyncio.get_event_loop().run_in_executor(
            None,
            quality_improver.improve_persona_quality,
            core_persona,
            platform_personas,
            quality_metrics
        )
        
        if improvement_result and "error" not in improvement_result:
            logger.info("✅ Persona quality improvement successful")
            return improvement_result
        else:
            logger.warning("⚠️ Persona quality improvement failed or no improvement needed")
            return None
            
    except Exception as e:
        logger.error(f"❌ Error during quality improvement: {str(e)}")
        return None

def extract_text_samples_for_analysis(onboarding_data: Dict[str, Any]) -> List[str]:
    """Extract comprehensive text samples for linguistic analysis."""
    text_samples = []
    
    # Extract from website analysis
    website_analysis = onboarding_data.get('websiteAnalysis', {})
    if isinstance(website_analysis, dict):
        for key, value in website_analysis.items():
            if isinstance(value, str) and len(value) > 50:
                text_samples.append(value)
            elif isinstance(value, list):
                for item in value:
                    if isinstance(item, str) and len(item) > 50:
                        text_samples.append(item)
    
    # Extract from competitor research
    competitor_research = onboarding_data.get('competitorResearch', {})
    if isinstance(competitor_research, dict):
        competitors = competitor_research.get('competitors', [])
        for competitor in competitors:
            if isinstance(competitor, dict):
                summary = competitor.get('summary', '')
                if isinstance(summary, str) and len(summary) > 50:
                    text_samples.append(summary)
    
    # Extract from sitemap analysis
    sitemap_analysis = onboarding_data.get('sitemapAnalysis', {})
    if isinstance(sitemap_analysis, dict):
        for key, value in sitemap_analysis.items():
            if isinstance(value, str) and len(value) > 50:
                text_samples.append(value)
    
    logger.info(f"📝 Extracted {len(text_samples)} text samples for linguistic analysis")
    return text_samples
