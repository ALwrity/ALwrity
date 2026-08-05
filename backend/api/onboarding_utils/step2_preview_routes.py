"""
SEO Preview endpoints for onboarding — lightweight subset of full analysis.
Stores results in SEOPageAudit so the SEO dashboard can display them.
"""

from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException
from loguru import logger
from middleware.auth_middleware import get_current_user

router = APIRouter(prefix="/api/onboarding/step2", tags=["Onboarding SEO Preview"])


@router.post("/preview-seo-audit")
async def preview_seo_audit(
    request: Dict[str, Any],
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Run a 3-page SEO preview and return sample results synchronously.

    Results are also persisted to SEOPageAudit with analysis_source='preview'
    so the SEO dashboard can display them alongside the full audit.
    """
    website_url = request.get("website_url", "").strip()
    if not website_url:
        raise HTTPException(status_code=400, detail="website_url is required")

    user_id = str(current_user.get("id", "unknown"))
    logger.info(f"[SeoPreview] Requested by user={user_id} for {website_url}")

    from services.seo_analyzer.seo_preview import run_seo_preview

    try:
        result = await run_seo_preview(website_url)
    except Exception as e:
        logger.error(f"[SeoPreview] Failed for {website_url}: {e}")
        raise HTTPException(status_code=500, detail=f"SEO preview failed: {e}")

    # Persist to SEOPageAudit so SEO dashboard can display preview results
    if result.get("success") and result.get("pages"):
        try:
            from services.database import get_session_for_user
            from models.onboarding import SEOPageAudit
            from datetime import datetime

            db = get_session_for_user(user_id)
            for page in result["pages"]:
                page_url = page["url"]
                existing = (
                    db.query(SEOPageAudit)
                    .filter(
                        SEOPageAudit.user_id == user_id,
                        SEOPageAudit.page_url == page_url,
                        SEOPageAudit.analysis_source == "preview",
                    )
                    .first()
                )
                if existing:
                    existing.overall_score = int(page.get("overall_score", 0))
                    existing.category_scores = {
                        k: v.get("score", 0) if isinstance(v, dict) else v
                        for k, v in page.items()
                        if k in ("meta", "content", "technical", "accessibility", "ux", "url_structure")
                    }
                    existing.issues = page.get("top_issues", [])
                    existing.audit_data = page
                    existing.last_analyzed_at = datetime.utcnow()
                else:
                    row = SEOPageAudit(
                        user_id=user_id,
                        website_url=website_url,
                        page_url=page_url,
                        overall_score=int(page.get("overall_score", 0)),
                        status="needs_review",
                        category_scores={
                            k: v.get("score", 0) if isinstance(v, dict) else v
                            for k, v in page.items()
                            if k in ("meta", "content", "technical", "accessibility", "ux", "url_structure")
                        },
                        issues=page.get("top_issues", []),
                        audit_data=page,
                        analysis_source="preview",
                    )
                    db.add(row)
            db.commit()
            db.close()
            logger.info(f"[SeoPreview] Stored {len(result['pages'])} pages to SEOPageAudit for user={user_id}")
        except Exception as store_err:
            logger.warning(f"[SeoPreview] Failed to persist results: {store_err}")

    return result
