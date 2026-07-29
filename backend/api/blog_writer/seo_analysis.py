"""
Blog Writer SEO Analysis API Endpoint

Provides API endpoint for analyzing blog content SEO with parallel processing
and CopilotKit integration for real-time progress updates.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
from loguru import logger
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import select

from services.blog_writer.seo.blog_content_seo_analyzer import BlogContentSEOAnalyzer
from services.blog_writer.core.blog_writer_service import BlogWriterService
from middleware.auth_middleware import get_current_user
from services.database import get_db
from models.seo_analysis import SEOAnalysis


router = APIRouter(prefix="/api/blog-writer/seo", tags=["Blog SEO Analysis"])


class SEOAnalysisRequest(BaseModel):
    """Request model for SEO analysis"""
    blog_content: str
    blog_title: Optional[str] = None
    research_data: Dict[str, Any]
    outline: Optional[List[Dict[str, Any]]] = None
    competitive_advantage: Optional[str] = None
    user_id: Optional[str] = None
    session_id: Optional[str] = None


class SEOAnalysisResponse(BaseModel):
    """Response model for SEO analysis"""
    success: bool
    analysis_id: str
    overall_score: float
    category_scores: Dict[str, float]
    analysis_summary: Dict[str, Any]
    actionable_recommendations: list
    detailed_analysis: Optional[Dict[str, Any]] = None
    visualization_data: Optional[Dict[str, Any]] = None
    generated_at: str
    error: Optional[str] = None


class SEOAnalysisProgress(BaseModel):
    """Progress update model for real-time updates"""
    analysis_id: str
    stage: str
    progress: int
    message: str
    timestamp: str


# Initialize analyzer
seo_analyzer = BlogContentSEOAnalyzer()
blog_writer_service = BlogWriterService()


@router.post("/analyze", response_model=SEOAnalysisResponse)
async def analyze_blog_seo(
    request: SEOAnalysisRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Analyze blog content for SEO optimization
    
    This endpoint performs comprehensive SEO analysis including:
    - Content structure analysis
    - Keyword optimization analysis
    - Readability assessment
    - Content quality evaluation
    - AI-powered insights generation
    
    Args:
        request: SEOAnalysisRequest containing blog content and research data
        current_user: Authenticated user from middleware
        
    Returns:
        SEOAnalysisResponse with comprehensive analysis results
    """
    try:
        logger.info(f"Starting SEO analysis for blog content")
        
        # Extract Clerk user ID (required)
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        user_id = str(current_user.get('id', ''))
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid user ID in authentication token")
        
        # Validate request
        if not request.blog_content or not request.blog_content.strip():
            raise HTTPException(status_code=400, detail="Blog content is required")
        
        if not request.research_data:
            raise HTTPException(status_code=400, detail="Research data is required")
        
        # Generate analysis ID
        import uuid
        analysis_id = str(uuid.uuid4())
        
        # Perform SEO analysis
        analysis_results = await seo_analyzer.analyze_blog_content(
            blog_content=request.blog_content,
            research_data=request.research_data,
            blog_title=request.blog_title,
            user_id=user_id,
            outline=request.outline,
            competitive_advantage=request.competitive_advantage,
        )
        
        # Check for errors
        if 'error' in analysis_results:
            logger.error(f"SEO analysis failed: {analysis_results['error']}")
            return SEOAnalysisResponse(
                success=False,
                analysis_id=analysis_id,
                overall_score=0,
                category_scores={},
                analysis_summary={},
                actionable_recommendations=[],
                detailed_analysis=None,
                visualization_data=None,
                generated_at=analysis_results.get('generated_at', ''),
                error=analysis_results['error']
            )
        
        # Return successful response
        return SEOAnalysisResponse(
            success=True,
            analysis_id=analysis_id,
            overall_score=analysis_results.get('overall_score', 0),
            category_scores=analysis_results.get('category_scores', {}),
            analysis_summary=analysis_results.get('analysis_summary', {}),
            actionable_recommendations=analysis_results.get('actionable_recommendations', []),
            detailed_analysis=analysis_results.get('detailed_analysis'),
            visualization_data=analysis_results.get('visualization_data'),
            generated_at=analysis_results.get('generated_at', '')
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"SEO analysis endpoint error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/analyze-with-progress")
async def analyze_blog_seo_with_progress(
    request: SEOAnalysisRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Analyze blog content for SEO with real-time progress updates
    
    This endpoint provides real-time progress updates for CopilotKit integration.
    It returns a stream of progress updates and final results.
    
    Args:
        request: SEOAnalysisRequest containing blog content and research data
        current_user: Authenticated user from middleware
        db: Database session
        
    Returns:
        Generator yielding progress updates and final results
    """
    try:
        logger.info(f"Starting SEO analysis with progress for blog content")
        
        # Extract Clerk user ID (required)
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        user_id = str(current_user.get('id', ''))
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid user ID in authentication token")
        
        # Validate request
        if not request.blog_content or not request.blog_content.strip():
            raise HTTPException(status_code=400, detail="Blog content is required")
        
        if not request.research_data:
            raise HTTPException(status_code=400, detail="Research data is required")
        
        # Generate analysis ID
        import uuid
        analysis_id = str(uuid.uuid4())
        
        # Yield progress updates
        async def progress_generator():
            try:
                # Stage 1: Initialization
                yield SEOAnalysisProgress(
                    analysis_id=analysis_id,
                    stage="initialization",
                    progress=10,
                    message="Initializing SEO analysis...",
                    timestamp=datetime.utcnow().isoformat()
                )
                
                # Stage 2: Keyword extraction
                yield SEOAnalysisProgress(
                    analysis_id=analysis_id,
                    stage="keyword_extraction",
                    progress=20,
                    message="Extracting keywords from research data...",
                    timestamp=datetime.utcnow().isoformat()
                )
                
                # Stage 3: Non-AI analysis
                yield SEOAnalysisProgress(
                    analysis_id=analysis_id,
                    stage="non_ai_analysis",
                    progress=40,
                    message="Running content structure and readability analysis...",
                    timestamp=datetime.utcnow().isoformat()
                )
                
                # Stage 4: AI analysis
                yield SEOAnalysisProgress(
                    analysis_id=analysis_id,
                    stage="ai_analysis",
                    progress=70,
                    message="Generating AI-powered insights...",
                    timestamp=datetime.utcnow().isoformat()
                )
                
                # Stage 5: Results compilation
                yield SEOAnalysisProgress(
                    analysis_id=analysis_id,
                    stage="compilation",
                    progress=90,
                    message="Compiling analysis results...",
                    timestamp=datetime.utcnow().isoformat()
                )
                
                # Perform actual analysis
                analysis_results = await seo_analyzer.analyze_blog_content(
                    blog_content=request.blog_content,
                    research_data=request.research_data,
                    blog_title=request.blog_title,
                    user_id=user_id
                )
                
                # Save to Database
                try:
                    draft_url = f"draft:{analysis_id}"
                    overall_score = analysis_results.get('overall_score', 0)
                    
                    # Determine health status
                    if overall_score >= 90:
                        health_status = "excellent"
                    elif overall_score >= 70:
                        health_status = "good"
                    elif overall_score >= 50:
                        health_status = "needs_improvement"
                    else:
                        health_status = "poor"

                    new_analysis = SEOAnalysis(
                        url=draft_url,
                        overall_score=int(overall_score),
                        health_status=health_status,
                        timestamp=datetime.utcnow(),
                        analysis_data=analysis_results
                    )
                    db.add(new_analysis)
                    db.commit()
                    logger.info(f"Saved SEO analysis results to DB for ID: {analysis_id}")
                except Exception as db_error:
                    logger.error(f"Failed to save analysis to DB: {db_error}")
                    # Continue without failing
                
                # Final result
                yield SEOAnalysisProgress(
                    analysis_id=analysis_id,
                    stage="completed",
                    progress=100,
                    message="SEO analysis completed successfully!",
                    timestamp=datetime.utcnow().isoformat()
                )
                
                # Yield final results (can't return in async generator)
                yield analysis_results
                
            except Exception as e:
                logger.error(f"Progress generator error: {e}", exc_info=True)
                yield SEOAnalysisProgress(
                    analysis_id=analysis_id,
                    stage="error",
                    progress=0,
                    message=f"Analysis failed: {str(e)}",
                    timestamp=datetime.utcnow().isoformat()
                )
                raise
        
        return progress_generator()
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"SEO analysis with progress endpoint error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/analysis/{analysis_id}")
async def get_analysis_result(
    analysis_id: str,
    db: Session = Depends(get_db)
):
    """
    Get SEO analysis result by ID
    
    Args:
        analysis_id: Unique identifier for the analysis
        db: Database session
        
    Returns:
        SEO analysis results
    """
    try:
        logger.info(f"Retrieving SEO analysis result for ID: {analysis_id}")
        
        # Look for the analysis in the database
        draft_url = f"draft:{analysis_id}"
        stmt = select(SEOAnalysis).where(SEOAnalysis.url == draft_url)
        analysis = db.execute(stmt).scalar_one_or_none()
        
        if analysis and analysis.analysis_data:
            # Return stored analysis data
            return {
                "analysis_id": analysis_id,
                "status": "completed",
                "message": "Analysis results retrieved successfully",
                **analysis.analysis_data
            }
        
        # If not found in DB (fallback for legacy or in-memory only)
        # For now, we return 404 to encourage DB usage, or we could return a placeholder if strictly needed.
        # But user requested DB integration, so we should rely on DB.
        
        logger.warning(f"Analysis result not found in DB for ID: {analysis_id}")
        raise HTTPException(status_code=404, detail="Analysis result not found")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get analysis result error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/health")
async def health_check():
    """Health check endpoint for SEO analysis service"""
    return {
        "status": "healthy",
        "service": "blog-seo-analysis",
        "timestamp": datetime.utcnow().isoformat()
    }


